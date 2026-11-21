// Yakındaki cihazlar akışı: tarayıcıdaki uygulama, worker/ içindeki GERÇEK Room koduyla
// konuşur (WebSocket Playwright ile araya alınır, ağ gerekmez). Eşleşmeden sonra
// iki sayfa arasında gerçek WebRTC bağlantısı kurulur ve dosya aktarılır.
// Çalıştırmak için:  npm i -D playwright && node test/e2e-yakin.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- worker'ın Room sınıfını Node'da çalıştırmak için küçük taklitler -----
globalThis.WebSocketRequestResponsePair = class {};
globalThis.WebSocketPair = class {
  constructor() {
    const mk = () => ({
      readyState: 1, att: null, out: null,
      send(m) { this.out?.(m); },
      close() { this.readyState = 3; },
      serializeAttachment(a) { this.att = a; },
      deserializeAttachment() { return this.att; },
    });
    this[0] = mk(); this[1] = mk();
    // Room.fetch içinde (soket kabul edilmeden önce) gönderilen iletiler de tarayıcıya gitsin.
    const out = globalThis.__out;
    this[1].out = (m) => out?.(m);
  }
};
const RealResponse = globalThis.Response;
const FakeResponse = class { constructor(b, o = {}) { this.status = o.status ?? 200; this.webSocket = o.webSocket; } };
const { Room } = await import(pathToFileURL(path.join(root, 'worker/src/index.js')).href);

const rooms = new Map(); // oda anahtarı → Room
function roomFor(key) {
  if (!rooms.has(key)) {
    const ctx = {
      list: [],
      setWebSocketAutoResponse() {},
      acceptWebSocket(ws) { ctx.list.push(ws); },
      getWebSockets() { return ctx.list; },
    };
    rooms.set(key, new Room(ctx));
  }
  return rooms.get(key);
}

// Tarayıcı WebSocket'ini Room'a bağlar. Tüm sayfalar aynı "ağ"dadır (aynı IP odası).
async function bridge(page) {
  await page.routeWebSocket('**/ws*', async (route) => {
    const url = new URL(route.url());
    const key = url.searchParams.get('code') ? 'c:' + url.searchParams.get('code') : 'n:ayni-ag';
    const room = roomFor(key);
    globalThis.Response = FakeResponse;
    globalThis.__out = (m) => route.send(m);
    let res;
    try { res = await room.fetch({ url: route.url() }); } finally { globalThis.Response = RealResponse; globalThis.__out = null; }
    if (res.status !== 101) return route.close();
    const sock = room.ctx.list.at(-1);
    route.onMessage((m) => { if (m === 'ping') return route.send('pong'); room.webSocketMessage(sock, m); });
    route.onClose(() => { sock.readyState = 3; room.webSocketClose(sock); });
  });
}
const openSockets = () => [...rooms.values()].reduce((n, r) => n + r.ctx.list.filter((w) => w.readyState === 1).length, 0);

// --- statik sunucu ---------------------------------------------------------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

let failed = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failed++; };
const peersOf = (pg) => pg.$$eval('#peer-list .pname', (els) => els.map((e) => e.textContent));
const waitPeers = (pg, n) => pg.waitForFunction((n) => document.querySelectorAll('#peer-list li').length === n, n, { timeout: 10000 });

const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
try {
  const mk = async () => {
    const pg = await (await browser.newContext()).newPage();
    pg.on('pageerror', (e) => { console.log('pageerror', e.message); failed++; });
    await bridge(pg);
    await pg.goto(base);
    return pg;
  };
  const a = await mk();
  const b = await mk();

  // 1) Aynı ağdaki iki cihaz birbirini görür
  await waitPeers(a, 1); await waitPeers(b, 1);
  ok((await peersOf(a))[0].includes(' · '), 'A, B\u2019yi listede görüyor: ' + (await peersOf(a))[0]);
  ok((await a.textContent('#me-name')).includes('Bu cihazın adı'), 'cihaz kendi adını gösteriyor');

  // 2) Reddetme
  await a.click('#peer-list button');
  await b.waitForSelector('#v-ask:not([hidden])', { timeout: 10000 });
  ok((await b.textContent('#ask-text')).includes('bağlanmak istiyor'), 'B\u2019de onay ekranı açıldı');
  await b.click('#ask-no');
  await a.waitForSelector('#v-home:not([hidden])', { timeout: 10000 });
  ok((await a.textContent('#error')).includes('reddetti'), 'A reddedildiğini öğrendi');

  // 3) Vazgeçme: A isteği geri çeker, B'deki onay ekranı kapanır
  await a.click('#peer-list button');
  await b.waitForSelector('#v-ask:not([hidden])', { timeout: 10000 });
  await a.click('#wait-cancel');
  await b.waitForSelector('#v-home:not([hidden])', { timeout: 10000 });
  ok(true, 'A vazgeçince B\u2019deki istek kapandı');

  // 4) Kabul: gerçek WebRTC bağlantısı
  await a.click('#peer-list button');
  await b.waitForSelector('#v-ask:not([hidden])', { timeout: 10000 });
  await b.click('#ask-yes');
  await Promise.all([
    a.waitForSelector('#v-live:not([hidden])', { timeout: 20000 }),
    b.waitForSelector('#v-live:not([hidden])', { timeout: 20000 }),
  ]);
  ok(true, 'kabul edilince iki taraf da bağlandı');
  ok((await a.textContent('#live-status')).includes('·'), 'bağlanılan cihazın adı görünüyor');

  // 5) Bağlanınca eşleştirme sunucusu bağlantısı kapanır
  await a.waitForFunction(() => true);
  await new Promise((r) => setTimeout(r, 500));
  ok(openSockets() === 0, 'bağlandıktan sonra eşleştirme sunucusuyla bağlantı kalmadı');

  // 6) Dosya aktarımı
  const data = crypto.randomBytes(300 * 1024);
  const want = crypto.createHash('sha256').update(data).digest('hex');
  await a.setInputFiles('#file-input', { name: 'deneme.bin', mimeType: 'application/octet-stream', buffer: data });
  await b.waitForSelector('#transfers a.dl', { timeout: 20000 });
  const got = await b.evaluate(async () => {
    const buf = await (await fetch(document.querySelector('#transfers a.dl').href)).arrayBuffer();
    const h = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
  });
  ok(got === want, 'dosya SHA-256 ile birebir geldi');

  // 7) Bağlantıyı kesince iki taraf da listeyi yeniden görür
  await a.click('#btn-disconnect');
  await b.waitForSelector('#v-home:not([hidden])', { timeout: 15000 });
  await waitPeers(a, 1); await waitPeers(b, 1);
  ok(true, 'kesildikten sonra iki cihaz yine birbirini görüyor');

  // 8) Kodla bağlan: yalnızca aynı kodu girenler görünür
  const c = await mk();
  await waitPeers(c, 2);
  await a.click('#btn-code');
  await a.click('#code-new');
  const code = (await a.textContent('#code-room')).replace(/\D/g, '');
  ok(/^\d{6}$/.test(code), 'yeni oda kodu üretildi: ' + code);
  await waitPeers(a, 0);
  await c.click('#btn-code');
  await c.fill('#code-input', code);
  await c.click('#code-go');
  await waitPeers(a, 1); await waitPeers(c, 1);
  ok(true, 'aynı kodu giren iki cihaz birbirini görüyor');
  await waitPeers(b, 0); // B artık yalnız (A ve C odadan çıktı)
  ok((await b.textContent('#nearby-status')).includes('Wi-Fi'), 'kodsuz cihaz karışmıyor');
  await c.click('#code-leave');
  await waitPeers(c, 1); // C varsayılan odaya (B ile) döner
  ok(true, 'koddan çıkınca varsayılan odaya dönülüyor');

  // 9) Sunucu kapalıysa uygulama bunu söyler, QR yolu kullanılabilir kalır
  const d = await (await browser.newContext()).newPage();
  await d.routeWebSocket('**/ws*', (ws) => ws.close());
  await d.goto(base);
  await d.waitForFunction(() => document.querySelector('#nearby-status').textContent.includes('ulaşılamadı'), null, { timeout: 10000 });
  ok(true, 'sunucuya ulaşılamayınca kullanıcıya bildiriliyor');
  await d.evaluate(() => { document.querySelector('#qr-mode').open = true; });
  ok(await d.isVisible('#btn-host'), 'QR yolu hâlâ erişilebilir');
} catch (e) {
  console.log('HATA', e);
  failed++;
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `\n${failed} sınama BAŞARISIZ` : '\nTüm sınamalar geçti');
process.exit(failed ? 1 : 0);
