// Yakındaki cihazları bulma ve eşleşme bilgisini iletme (WebSocket).
//
// Sunucu yalnızca "kim var" listesini tutar ve kısa bağlantı kodlarını iki
// cihaz arasında taşır. Dosyalar ve metinler buradan geçmez; onlar WebRTC ile
// doğrudan akar. Bağlantı kurulunca bu soket kapatılır.
//
// Eşleştirme sunucusunun adresi (worker/ klasöründeki Cloudflare Worker):
export const SERVER = 'wss://hadigit.uozguler.workers.dev/ws';

function randomId() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return [...a].map((b) => (b % 36).toString(36)).join('');
}

// Sekme başına bir kimlik: iki sekme aynı cihazda birbirini "ikinci cihaz" görür.
export function deviceId() {
  try {
    let id = sessionStorage.getItem('did');
    if (!id) {
      id = randomId();
      sessionStorage.setItem('did', id);
    }
    return id;
  } catch {
    return (deviceId.mem ??= randomId());
  }
}

export function deviceName(id = deviceId()) {
  const ua = navigator.userAgent;
  let base = 'Cihaz';
  if (/iPhone/.test(ua)) base = 'iPhone';
  else if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) base = 'iPad';
  else if (/Android/.test(ua)) base = /Mobile/.test(ua) ? 'Android telefon' : 'Android tablet';
  else if (/Windows/.test(ua)) base = 'Windows bilgisayar';
  else if (/CrOS/.test(ua)) base = 'Chromebook';
  else if (/Mac/.test(ua)) base = 'Mac';
  else if (/Linux/.test(ua)) base = 'Linux bilgisayar';
  return `${base} · ${id.slice(0, 3).toUpperCase()}`;
}

export class Discovery {
  // o: { onStatus('connecting'|'online'|'offline'), onPeers(liste), onSignal(from, name, data), onGone(id) }
  constructor(o, code = null) {
    this.o = o;
    this.code = code;
    this.id = deviceId();
    this.name = deviceName(this.id);
    this.ws = null;
    this.closed = false;
    this.retry = 0;
    this.timers = new Set();
    this._onVis = () => {
      if (!this.closed && document.visibilityState === 'visible' && this.ws?.readyState !== 1) this._open();
    };
    document.addEventListener('visibilitychange', this._onVis);
    this._open();
  }

  _later(fn, ms) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  _open() {
    if (this.closed) return;
    try { this.ws?.close(); } catch {}
    this.o.onStatus?.('connecting');
    const q = new URLSearchParams({ id: this.id, name: this.name });
    if (this.code) q.set('code', this.code);
    let ws;
    try {
      ws = new WebSocket(SERVER + '?' + q);
    } catch {
      this.o.onStatus?.('offline');
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.o.onStatus?.('online');
      this._beat();
    };
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'peers') this.o.onPeers?.(m.peers.filter((p) => p.id !== this.id));
      else if (m.t === 'sig') this.o.onSignal?.(m.from, m.name, m.data);
      else if (m.t === 'gone') this.o.onGone?.(m.id);
    };
    ws.onclose = () => {
      if (this.ws !== ws || this.closed) return;
      this.o.onStatus?.('offline');
      this.o.onPeers?.([]);
      const wait = Math.min(15000, 1000 * 2 ** this.retry++);
      this._later(() => this._open(), wait);
    };
    ws.onerror = () => {};
  }

  // Bağlantı boşta kalıp kapanmasın diye aralıklı 'ping'.
  _beat() {
    this._later(() => {
      if (this.ws?.readyState === 1) {
        this.ws.send('ping');
        this._beat();
      }
    }, 25000);
  }

  send(to, data) {
    if (this.ws?.readyState !== 1) return false;
    this.ws.send(JSON.stringify({ t: 'sig', to, data }));
    return true;
  }

  stop() {
    this.closed = true;
    document.removeEventListener('visibilitychange', this._onVis);
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    try { this.ws?.close(); } catch {}
    this.ws = null;
  }
}
