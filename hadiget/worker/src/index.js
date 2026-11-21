// hadiGET eşleştirme sunucusu (Cloudflare Worker + Durable Object).
//
// Görevi yalnızca şu: aynı odadaki cihazların birbirini görmesini ve
// bağlantı bilgisini (kısa "teklif"/"cevap" kodları) birbirine iletmesini
// sağlamak. Dosya, metin ya da başka bir içerik buradan GEÇMEZ; onlar iki
// cihaz arasında doğrudan (WebRTC) akar. Sunucu hiçbir şeyi saklamaz.
//
// Oda iki şekilde belirlenir:
//   - varsayılan:  aynı genel IP adresinden gelenler aynı odadadır (aynı Wi-Fi)
//   - ?code=123456: aynı kodu girenler aynı odadadır (farklı ağlar için)

const MAX_PEERS = 20; // bir odada en fazla cihaz
const MAX_MSG = 16 * 1024; // bir ileti en fazla bu kadar bayt

// Boş bırakırsan her adresten bağlanılabilir. Doldurursan yalnızca bu
// adreslerdeki uygulama bağlanabilir. Örn: ['https://kullanici.github.io']
const ALLOWED_ORIGINS = [];

// IPv6'da aynı ağdaki cihazlar çoğu zaman yalnızca son 64 bitte ayrılır
// (gizlilik adresleri). Bu yüzden ilk 4 öbeği (/64) oda anahtarı sayarız.
export function ipKey(ip) {
  if (!ip) return 'bilinmiyor';
  if (!ip.includes(':')) return ip; // IPv4
  let [head, tail] = ip.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const full = ip.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return full.slice(0, 4).map((x) => x.toLowerCase().replace(/^0+(?=.)/, '')).join(':');
}

// Oda adı olarak ham IP yerine tek yönlü özeti (SHA-256) kullanılır.
async function digest(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hadiget-oda-v1|' + text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/saglik') {
      return new Response('hadiGET eşleştirme sunucusu çalışıyor.\n', {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
    if (url.pathname !== '/ws') return new Response('Bulunamadı', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('WebSocket gerekli', { status: 426 });
    }

    const origin = request.headers.get('Origin');
    if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(origin)) {
      return new Response('İzin yok', { status: 403 });
    }

    const code = url.searchParams.get('code');
    let room;
    if (code) {
      if (!/^\d{6}$/.test(code)) return new Response('Kod 6 haneli olmalı', { status: 400 });
      room = 'c:' + code;
    } else {
      room = 'n:' + (await digest(ipKey(request.headers.get('CF-Connecting-IP'))));
    }

    const stub = env.ROOMS.get(env.ROOMS.idFromName(room));
    return stub.fetch(request);
  },
};

// Bir oda = bir Durable Object. Bağlantılar "hibernation" ile tutulur:
// kimse konuşmuyorsa nesne uyur, ücretsiz kotayı yemez.
export class Room {
  constructor(ctx) {
    this.ctx = ctx;
    // Tarayıcı 'ping' yazarsa uyandırmadan 'pong' döner.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    const url = new URL(request.url);
    const id = (url.searchParams.get('id') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24);
    const name = (url.searchParams.get('name') || 'Cihaz').replace(/[\u0000-\u001f<>]/g, '').slice(0, 40) || 'Cihaz';
    if (id.length < 6) return new Response('Geçersiz kimlik', { status: 400 });

    const others = this._open();
    // Aynı kimlikle yeniden bağlanıyorsa eskisini kapat (sekme yenileme).
    for (const ws of others) {
      if (ws.deserializeAttachment()?.id === id) {
        try { ws.close(4000, 'yeni bağlantı'); } catch {}
      }
    }
    const alive = others.filter((ws) => ws.deserializeAttachment()?.id !== id);
    if (alive.length >= MAX_PEERS) return new Response('Oda dolu', { status: 429 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id, name });
    server.send(JSON.stringify({ t: 'hello', id }));
    this._broadcastPeers();
    return new Response(null, { status: 101, webSocket: client });
  }

  // Yalnızca açık (OPEN = 1) soketler sayılır; kapanmakta olan listede kalmasın.
  _open() {
    return this.ctx.getWebSockets().filter((ws) => ws.readyState === 1);
  }

  _peers() {
    return this._open()
      .map((ws) => ws.deserializeAttachment())
      .filter(Boolean);
  }

  _broadcastPeers(except) {
    const msg = JSON.stringify({ t: 'peers', peers: this._peers() });
    for (const ws of this._open()) {
      if (ws === except) continue;
      try { ws.send(msg); } catch {}
    }
  }

  webSocketMessage(ws, data) {
    if (typeof data !== 'string' || data.length > MAX_MSG) return;
    let m;
    try { m = JSON.parse(data); } catch { return; }
    const me = ws.deserializeAttachment();
    if (!me) return;

    if (m.t === 'sig' && typeof m.to === 'string' && m.data && typeof m.data === 'object') {
      const target = this._open().find((w) => w.deserializeAttachment()?.id === m.to);
      if (!target) {
        // Karşı taraf gitmiş: gönderene haber ver.
        try { ws.send(JSON.stringify({ t: 'gone', id: m.to })); } catch {}
        return;
      }
      try { target.send(JSON.stringify({ t: 'sig', from: me.id, name: me.name, data: m.data })); } catch {}
    }
  }

  webSocketClose(ws) {
    // Kapanan soket listeden düşsün, kalanlara yeni liste gitsin.
    try { ws.close(); } catch {}
    this._broadcastPeers(ws);
  }

  webSocketError(ws) {
    this.webSocketClose(ws);
  }
}
