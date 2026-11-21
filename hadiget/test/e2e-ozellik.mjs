// Yeni özellikler: önizleme, çizim editörü, iptal, büyük dosya (diske yazma), klasör→zip,
// panodan yapıştırma, dil değiştirme. Çalıştırmak için:  node test/e2e-ozellik.mjs
// Ortam değişkenleri: MDNS=1 → Chrome'un varsayılan yerel adres gizlemesiyle dene.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
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
const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
try {
  const mk = async () => {
    const pg = await (await browser.newContext({ locale: 'tr-TR', permissions: [] })).newPage();
    pg.on('pageerror', (e) => { console.log('pageerror', e.message); failed++; });
    await pg.routeWebSocket('**/ws*', (ws) => ws.close());
    await pg.goto(base);
    return pg;
  };
  const a = await mk();
  const b = await mk();
  for (const pg of [a, b]) await pg.evaluate(() => { document.querySelector('#qr-mode').open = true; });
  await a.click('#btn-host');
  await a.waitForFunction(() => document.querySelector('#host-code').value.length > 10);
  const offer = await a.inputValue('#host-code');
  await b.click('#btn-join');
  await b.fill('#join-offer', offer);
  await b.click('#join-go');
  await b.waitForFunction(() => document.querySelector('#join-code').value.length > 10);
  await a.fill('#host-answer', await b.inputValue('#join-code'));
  await a.click('#host-connect');
  await Promise.all([a.waitForSelector('#v-live:not([hidden])'), b.waitForSelector('#v-live:not([hidden])')]);
  ok(true, 'bağlandı');

  const items = (pg) => pg.locator('#transfers > li');

  // 1) Görsel gönder → karşıda önizleme + Düzenle
  const png = await a.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 200;
    const x = c.getContext('2d'); x.fillStyle = '#3b82f6'; x.fillRect(0, 0, 320, 200);
    const b = await new Promise((r) => c.toBlob(r, 'image/png'));
    return [...new Uint8Array(await b.arrayBuffer())];
  });
  await a.setInputFiles('#file-input', { name: 'resim.png', mimeType: 'image/png', buffer: Buffer.from(png) });
  await b.waitForSelector('#transfers .preview img', { timeout: 15000 });
  ok(true, 'alınan görselin önizlemesi var');
  ok(await b.locator('#transfers button.edit').count() === 1, 'alınan görselde Düzenle düğmesi var');
  await a.waitForSelector('#transfers .preview img');
  ok(await a.locator('#transfers button.edit').count() === 1, 'gönderilen görselde de Düzenle düğmesi var');

  // 2) Editör: çiz, "Karşıya gönder" → A düzenlenmiş dosyayı alır
  await b.click('#transfers button.edit');
  await b.waitForSelector('dialog.editor[open] canvas');
  const box = await b.locator('dialog.editor canvas').boundingBox();
  await b.mouse.move(box.x + 20, box.y + 20);
  await b.mouse.down();
  await b.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  await b.mouse.move(box.x + box.width - 20, box.y + 30, { steps: 8 });
  await b.mouse.up();
  const px = await b.evaluate(() => {
    const c = document.querySelector('dialog.editor canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let red = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 90 && d[i + 2] < 90) red++;
    return red;
  });
  ok(px > 100, `kalem çizimi tuvale işlendi (${px} kırmızı piksel)`);
  // ok + kutu + metin araçları hata vermeden çalışır
  await b.click('dialog.editor .ed-tool:has-text("Ok")');
  await b.mouse.move(box.x + 30, box.y + 100); await b.mouse.down(); await b.mouse.move(box.x + 120, box.y + 150, { steps: 4 }); await b.mouse.up();
  await b.click('dialog.editor .ed-tool:has-text("Metin")');
  await b.mouse.click(box.x + 40, box.y + 40);
  await b.fill('dialog.editor .ed-textrow input', 'Merhaba');
  await b.keyboard.press('Enter');
  await b.click('dialog.editor button:has-text("Geri al")');
  ok(true, 'ok, metin ve geri al araçları çalıştı');
  await b.click('dialog.editor button:has-text("Karşıya gönder")');
  await a.waitForFunction(() => [...document.querySelectorAll('#transfers a.dl')].some((x) => x.download.includes('duzenlendi')), null, { timeout: 15000 });
  ok(true, 'düzenlenmiş görsel karşıya ulaştı (resim-duzenlendi.png)');
  // Kaydet: indirme tetiklenir
  await a.click('#transfers li:has(a.dl) button.edit');
  await a.waitForSelector('dialog.editor[open]');
  const [dl] = await Promise.all([a.waitForEvent('download'), a.click('dialog.editor button.primary:has-text("Kaydet")')]);
  ok(dl.suggestedFilename() === 'resim-duzenlendi.png', 'editörden Kaydet indirmeyi başlattı: ' + dl.suggestedFilename());
  await a.click('dialog.editor button:has-text("Kapat")');
  await a.waitForSelector('dialog.editor', { state: 'detached' });
  ok(true, 'editör kapandı');

  // 3) Gönderen iptal eder
  const bigSend = (pg, mb, name) => pg.evaluate(({ mb, name }) => {
    const f = new File([new Uint8Array(mb * 1024 * 1024)], name, { type: 'application/octet-stream' });
    const dt = new DataTransfer(); dt.items.add(f);
    const inp = document.querySelector('#file-input'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
  }, { mb, name });
  await bigSend(a, 400, 'buyuk-iptal.bin');
  await a.waitForSelector('#transfers li:has-text("buyuk-iptal.bin") button.danger');
  await a.waitForFunction(() => document.querySelector('#transfers li progress').value > 0.01);
  await a.click('#transfers li:has-text("buyuk-iptal.bin") button.danger');
  await a.waitForFunction(() => document.querySelector('#transfers li:has(.name)')?.textContent.includes('İptal edildi'), null, { timeout: 10000 });
  await b.waitForFunction(() => [...document.querySelectorAll('#transfers li')].some((l) => l.textContent.includes('buyuk-iptal.bin') && l.textContent.includes('Karşı taraf iptal etti')), null, { timeout: 10000 });
  ok(true, 'gönderen iptal etti: iki taraf da iptali gördü');

  // Ardından küçük dosya yine gider (kanal bozulmadı)
  await a.setInputFiles('#file-input', { name: 'sonra.txt', mimeType: 'text/plain', buffer: Buffer.from('iptalden sonra gelen metin dosyası') });
  await b.waitForFunction(() => [...document.querySelectorAll('#transfers li')].some((l) => l.textContent.includes('sonra.txt') && l.querySelector('a.dl')), null, { timeout: 10000 });
  ok((await b.locator('#transfers li:has-text("sonra.txt") pre').textContent()).includes('iptalden sonra'), 'iptalden sonra gelen dosya sağlam, metin önizlemesi var');

  // 4) Alan iptal eder
  await bigSend(a, 400, 'buyuk-alan.bin');
  await b.waitForSelector('#transfers li:has-text("buyuk-alan.bin") button.danger');
  await b.waitForFunction(() => [...document.querySelectorAll('#transfers li')].find((l) => l.textContent.includes('buyuk-alan.bin')).querySelector('progress').value > 0.01);
  await b.click('#transfers li:has-text("buyuk-alan.bin") button.danger');
  await a.waitForFunction(() => [...document.querySelectorAll('#transfers li')].some((l) => l.textContent.includes('buyuk-alan.bin') && l.textContent.includes('Karşı taraf iptal etti')), null, { timeout: 10000 });
  ok(true, 'alan iptal etti: gönderme durdu');
  await a.setInputFiles('#file-input', { name: 'sonra2.txt', mimeType: 'text/plain', buffer: Buffer.from('ikinci') });
  await b.waitForFunction(() => [...document.querySelectorAll('#transfers li')].some((l) => l.textContent.includes('sonra2.txt') && l.querySelector('a.dl')), null, { timeout: 10000 });
  ok(true, 'alan iptalinden sonra aktarım sürüyor');

  // 5) Büyük dosya (>64 MB) diske yazılır ve bozulmadan gelir
  const big = await a.evaluate(async () => {
    const parts = []; for (let i = 0; i < 80; i++) { const u = new Uint8Array(1024 * 1024); crypto.getRandomValues(u.subarray(0, 65536)); u[1000] = i; parts.push(u); }
    const f = new File(parts, 'buyuk.bin');
    const h = async (blob) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map((x) => x.toString(16).padStart(2, '0')).join('');
    const dt = new DataTransfer(); dt.items.add(f);
    const inp = document.querySelector('#file-input'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
    return { hash: await h(f), size: f.size };
  });
  await b.waitForFunction(() => [...document.querySelectorAll('#transfers li')].some((l) => l.textContent.includes('buyuk.bin') && l.querySelector('a.dl')), null, { timeout: 60000 });
  const rec = await b.evaluate(async () => {
    const a = [...document.querySelectorAll('#transfers li')].find((l) => l.textContent.includes('buyuk.bin') && l.querySelector('a.dl')).querySelector('a.dl');
    const blob = await (await fetch(a.href)).blob();
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map((x) => x.toString(16).padStart(2, '0')).join('');
    const root = await navigator.storage.getDirectory(); const dir = await root.getDirectoryHandle('hadiget-inbox');
    let n = 0; for await (const _ of dir.entries()) n++;
    return { size: blob.size, hash, inbox: n };
  });
  ok(rec.size === big.size && rec.hash === big.hash, `80 MB dosya SHA-256 ile birebir geldi`);
  ok(rec.inbox >= 1, 'büyük dosya belleğe değil, tarayıcının disk alanına (OPFS) yazıldı');

  // 6) Klasör → zip
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-'));
  fs.mkdirSync(path.join(dir, 'Belgeler/alt'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'Belgeler/bir.txt'), 'birinci dosya');
  fs.writeFileSync(path.join(dir, 'Belgeler/alt/ikinci.txt'), 'ikinci dosya');
  fs.writeFileSync(path.join(dir, 'Belgeler/alt/rastgele.bin'), crypto.randomBytes(200000));
  await a.setInputFiles('#dir-input', path.join(dir, 'Belgeler'));
  await b.waitForFunction(() => [...document.querySelectorAll('#transfers a.dl')].some((x) => x.download === 'Belgeler.zip'), null, { timeout: 15000 });
  const zbytes = await b.evaluate(async () => {
    const a = [...document.querySelectorAll('#transfers a.dl')].find((x) => x.download === 'Belgeler.zip');
    return [...new Uint8Array(await (await fetch(a.href)).arrayBuffer())];
  });
  const zf = path.join(dir, 'gelen.zip'); fs.writeFileSync(zf, Buffer.from(zbytes));
  const { execFileSync } = await import('node:child_process');
  const zout = execFileSync('python3', ['-I', '-c', `
import zipfile,sys
z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
print(sorted(z.namelist()))
print(z.read('Belgeler/alt/ikinci.txt').decode('utf-8'))`, zf], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).toString();
  ok(zout.includes("'Belgeler/alt/rastgele.bin'") && zout.includes("'Belgeler/bir.txt'") && zout.includes('ikinci dosya'), 'klasör geçerli bir zip olarak geldi (CRC doğru, alt klasörler, içerik sağlam)');
  // Türkçe dosya adı ve aynı ad çakışması
  const uz = await a.evaluate(async () => {
    const { makeZip } = await import('./zip.js');
    const z = await makeZip([{ name: 'K/ğüş.txt', file: new File(['türkçe içerik'], 'a.txt') }, { name: 'K/ğüş.txt', file: new File(['x'], 'b.txt') }]);
    return [...new Uint8Array(await z.arrayBuffer())];
  });
  const uzf = path.join(dir, 'u.zip'); fs.writeFileSync(uzf, Buffer.from(uz));
  const uout = execFileSync('python3', ['-I', '-c', `
import zipfile,sys
z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
print(sorted(z.namelist())); print(z.read('K/ğüş.txt').decode('utf-8'))`, uzf], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).toString();
  ok(uout.includes('K/ğüş (1).txt') && uout.includes('türkçe içerik'), 'zip: Türkçe dosya adı (UTF-8) ve aynı ad çakışması doğru');
  fs.rmSync(dir, { recursive: true, force: true });

  // 7) Çoklu seçim → tek zip (ayar açıkken)
  await a.check('#opt-zip', { force: true }).catch(async () => { await a.evaluate(() => { const c = document.querySelector('#opt-zip'); c.checked = true; c.dispatchEvent(new Event('change')); }); });
  await a.setInputFiles('#file-input', [
    { name: 'x1.txt', mimeType: 'text/plain', buffer: Buffer.from('1') },
    { name: 'x2.txt', mimeType: 'text/plain', buffer: Buffer.from('2') },
  ]);
  await b.waitForFunction(() => [...document.querySelectorAll('#transfers a.dl')].some((x) => /^hadiGET-.*\.zip$/.test(x.download)), null, { timeout: 15000 });
  ok(true, 'çoklu seçim tek zip olarak gönderildi');
  await a.evaluate(() => { const c = document.querySelector('#opt-zip'); c.checked = false; c.dispatchEvent(new Event('change')); });

  // 8) Panodan yapıştır
  await a.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'image.png', { type: 'image/png' }));
    const ev = new Event('paste', { bubbles: true, cancelable: true }); ev.clipboardData = dt;
    document.dispatchEvent(ev);
  });
  await b.waitForFunction(() => [...document.querySelectorAll('#transfers a.dl')].some((x) => /^pano-\d{6}\.png$/.test(x.download)), null, { timeout: 10000 });
  ok(true, 'panodan yapıştırılan görsel gönderildi (pano-HHMMSS.png)');

  // 9) Geçmiş ve hız bilgisi
  await a.click('#btn-disconnect');
  await a.click('#hist-details summary');
  ok((await a.locator('#hist-list li').count()) >= 5, 'oturum geçmişi kayıtları var');
  ok(!(await a.textContent('#hist-list')).includes('rastgele'), 'geçmişte dosya içeriği yok');

  // 10) Dil değiştirme
  ok((await a.textContent('.tag')).includes('Telefon ile'), 'varsayılan dil Türkçe (tr-TR)');
  await a.click('#set-details summary');
  await a.selectOption('#set-lang', 'en');
  ok((await a.textContent('.tag')).includes('Send files'), 'İngilizceye geçince arayüz çevrildi');
  ok((await a.getAttribute('html', 'lang')) === 'en', 'html lang özniteliği güncellendi');
  await a.selectOption('#set-lang', 'tr');

  // 11) Cihaz adı ayarı
  await a.fill('#set-name', 'Deneme telefonu');
  await a.dispatchEvent('#set-name', 'change');
  ok((await a.textContent('#me-name')).includes('Deneme telefonu'), 'özel cihaz adı kullanılıyor');

  // 12) Paylaşım menüsü: SW POST isteğini yakalayıp uygulamaya yönlendirir (localhost'ta çalışır)
  const sc = await (await browser.newContext({ locale: 'tr-TR' })).newPage();
  await sc.routeWebSocket('**/ws*', (ws) => ws.close());
  const lbase = base.replace('127.0.0.1', 'localhost');
  await sc.goto(lbase);
  await sc.evaluate(() => navigator.serviceWorker.ready);
  await sc.reload();
  await sc.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 10000 });
  await sc.evaluate(async () => {
    const fd = new FormData();
    fd.append('files', new File(['paylasilan icerik'], 'paylasim.txt', { type: 'text/plain' }));
    fd.append('text', 'merhaba paylaşım');
    const r = await fetch('share-target', { method: 'POST', body: fd, redirect: 'manual' });
    window.__share = r.type;
  });
  await sc.goto(lbase + '?share=1');
  await sc.waitForSelector('#share-banner:not([hidden])', { timeout: 5000 });
  ok((await sc.textContent('#share-text')).includes('2'), 'paylaşılan dosya+metin bantta görünüyor: ' + (await sc.textContent('#share-text')));
} catch (e) {
  console.log('HATA', e);
  failed++;
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `\n${failed} sınama BAŞARISIZ` : '\nTümü geçti');
process.exit(failed ? 1 : 0);
