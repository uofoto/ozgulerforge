// Uçtan uca test: iki ayrı tarayıcı bağlamı kod yapıştırarak eşleşir,
// dosya ve metin aktarır. Çalıştırmak için:  npm i -D playwright && node test/e2e.mjs
// Ortam değişkenleri: MDNS=1 → Chrome'un varsayılan yerel adres gizlemesiyle dene.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
};
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
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failed++; };

const args = process.env.MDNS ? [] : ['--disable-features=WebRtcHideLocalIpsWithMdns'];
const browser = await chromium.launch({ args });
try {
  const a = await (await browser.newContext({ locale: 'tr-TR' })).newPage();
  const b = await (await browser.newContext({ locale: 'tr-TR' })).newPage();
  for (const [n, pg] of [['A', a], ['B', b]]) {
    pg.on('pageerror', (e) => { console.log(`[${n}] pageerror`, e.message); failed++; });
  }
  // Bu test sunucusuz QR yolunu sınar: eşleştirme sunucusuna hiç bağlanmasın.
  for (const pg of [a, b]) await pg.routeWebSocket('**/ws*', (ws) => ws.close());
  await a.goto(base); await b.goto(base);
  for (const pg of [a, b]) await pg.evaluate(() => { document.querySelector('#qr-mode').open = true; });

  // 1) A bağlantı başlatır
  await a.click('#btn-host');
  await a.waitForFunction(() => document.querySelector('#host-code').value.length > 10);
  const offer = await a.inputValue('#host-code');
  ok(/^o\.[A-Za-z0-9_-]+$/.test(offer), `teklif kodu biçimi doğru (${offer.length} karakter)`);
  ok(offer.length < 900, 'teklif kodu QR için yeterince kısa');
  ok((await a.locator('#host-qr svg').count()) === 1, 'teklif QR çizildi');

  // QR'ı OpenCV ile okut: üretilen QR gerçekten taranabiliyor mu?
  const qrPng = path.join(root, 'test', '.qr-offer.png');
  await a.locator('#host-qr').screenshot({ path: qrPng });
  const { execFileSync } = await import('node:child_process');
  try {
    const out = execFileSync('python3', ['-c', `
import cv2, sys
img = cv2.imread(sys.argv[1])
img = cv2.copyMakeBorder(img, 40, 40, 40, 40, cv2.BORDER_CONSTANT, value=(255,255,255))
val, _, _ = cv2.QRCodeDetector().detectAndDecode(img)
print(val)
`, qrPng]).toString().trim();
    ok(out === offer, 'QR, OpenCV ile okununca aynı kodu veriyor');
  } catch (e) {
    console.log('SKIP QR okuma testi (OpenCV yok):', String(e.message).split('\n')[0]);
  } finally { fs.rmSync(qrPng, { force: true }); }

  // 2) B katılır
  await b.click('#btn-join');
  await b.fill('#join-offer', offer);
  await b.click('#join-go');
  await b.waitForFunction(() => document.querySelector('#join-code').value.length > 10);
  const answer = await b.inputValue('#join-code');
  ok(/^a\.[A-Za-z0-9_-]+$/.test(answer), `cevap kodu biçimi doğru (${answer.length} karakter)`);

  // 3) A cevabı alır
  await a.fill('#host-answer', answer);
  await a.click('#host-connect');
  await Promise.all([
    a.waitForSelector('#v-live:not([hidden])', { timeout: 20000 }),
    b.waitForSelector('#v-live:not([hidden])', { timeout: 20000 }),
  ]);
  ok(true, 'iki taraf da bağlandı');

  // 4) A → B: 5 MB rastgele dosya
  const data = crypto.randomBytes(5 * 1024 * 1024);
  const want = crypto.createHash('sha256').update(data).digest('hex');
  await a.setInputFiles('#file-input', { name: 'rastgele.bin', mimeType: 'application/octet-stream', buffer: data });
  await b.waitForSelector('#transfers a.dl', { timeout: 30000 });
  const got = await b.evaluate(async () => {
    const href = document.querySelector('#transfers a.dl').href;
    const buf = await (await fetch(href)).arrayBuffer();
    const h = await crypto.subtle.digest('SHA-256', buf);
    return { size: buf.byteLength, hash: [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('') };
  });
  ok(got.size === data.length, `boyut eşleşti (${got.size})`);
  ok(got.hash === want, 'SHA-256 eşleşti, dosya bozulmadan geldi');

  // 5) B → A: boş dosya ve Türkçe karakterli ad
  await b.setInputFiles('#file-input', { name: 'ğüşiöç boş.txt', mimeType: 'text/plain', buffer: Buffer.alloc(0) });
  await a.waitForSelector('#transfers a.dl', { timeout: 10000 });
  const dl = await a.evaluate(() => document.querySelector('#transfers a.dl').download);
  ok(dl === 'ğüşiöç boş.txt', 'boş dosya ve Türkçe ad doğru geldi');

  // 6) B → A: metin
  await b.fill('#text-input', 'merhaba https://örnek.test');
  await b.click('#text-send');
  await a.waitForFunction(() => [...document.querySelectorAll('#transfers .text')].some((e) => e.textContent.includes('merhaba')));
  ok(true, 'metin karşıya ulaştı');

  // 7) Bağlantıyı kesince diğer taraf haberdar olur
  await a.click('#btn-disconnect');
  await b.waitForSelector('#v-home:not([hidden])', { timeout: 15000 });
  ok((await b.textContent('#error')).includes('koptu'), 'kopma karşı tarafa bildirildi');

  // 7b) Yasal ve kılavuz sayfaları yayında, iletişim bilgisi doğru
  for (const page of ['nasil-kullanilir.html', 'gizlilik.html', 'kosullar.html']) {
    const res = await fetch(base + page);
    const html = await res.text();
    ok(res.status === 200, `${page} yayında`);
    ok(html.includes('mailto:iletisim@ozgulerforge.com.tr'), `${page} doğru e-posta adresini içeriyor`);
    ok(html.includes('https://ozgulerforge.com.tr'), `${page} web adresini içeriyor`);
  }
  const home = await (await fetch(base)).text();
  ok(home.includes('iletisim@ozgulerforge.com.tr') && home.includes('ozgulerforge.com.tr'), 'ana sayfa alt bilgisinde iletişim var');
  ok(!/iletsim@/.test(home), 'yanlış yazılmış e-posta kalmadı');
  ok(/<title>hadiGET/.test(home), 'başlıkta yeni ad var');

  // 8) Adresle otomatik katılım (#o.kod)
  const c = await (await browser.newContext({ locale: 'tr-TR' })).newPage();
  await a.click('#btn-host');
  await a.waitForFunction(() => document.querySelector('#host-code').value.length > 10);
  const offer2 = await a.inputValue('#host-code');
  await c.goto(base + '#' + offer2);
  await c.waitForFunction(() => document.querySelector('#join-code').value.length > 10, null, { timeout: 15000 });
  ok(true, 'adresle açılınca otomatik cevap üretildi');
  ok((await c.evaluate(() => location.hash)) === '', 'kod adres çubuğundan temizlendi');
} catch (e) {
  console.log('HATA', e);
  failed++;
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `\n${failed} başarısız` : '\nTümü geçti');
process.exit(failed ? 1 : 0);
