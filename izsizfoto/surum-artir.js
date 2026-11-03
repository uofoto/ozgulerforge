#!/usr/bin/env node
// Kullanım:  node surum-artir.js          → yama sürümünü 1 artırır (2.8.5 → 2.8.6)
//            node surum-artir.js 2.9.0    → belirtilen sürüme geçer
// index.html (APP.version + date), version.json ve sw.js (V) değerlerini birlikte günceller,
// sonra testleri çalıştırır. Bir yer bulunamazsa hiçbir dosyayı değiştirmez.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const dir = __dirname;
const P = { html: path.join(dir, 'index.html'), ver: path.join(dir, 'version.json'), sw: path.join(dir, 'sw.js') };
const read = (p) => fs.readFileSync(p, 'utf8');

const mevcut = (read(P.html).match(/APP = \{ version: '(\d+\.\d+\.\d+)'/) || [])[1];
if (!mevcut) { console.error('index.html içinde APP.version bulunamadı.'); process.exit(1); }

let yeni = process.argv[2];
if (!yeni) { const [a, b, c] = mevcut.split('.').map(Number); yeni = `${a}.${b}.${c + 1}`; }
if (!/^\d+\.\d+\.\d+$/.test(yeni)) { console.error('Sürüm biçimi 1.2.3 olmalı.'); process.exit(1); }
if (yeni === mevcut) { console.error(`Sürüm zaten ${mevcut}.`); process.exit(1); }

const d = new Date(), z = (n) => String(n).padStart(2, '0');
const iso = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const tr = `${z(d.getDate())}.${z(d.getMonth() + 1)}.${d.getFullYear()}`;

// Önce hepsini bellekte hazırla; biri tutmazsa diske hiçbir şey yazma.
const edits = [
  [P.html, /(APP = \{ version: ')\d+\.\d+\.\d+(', date: ')[^']*(')/, `$1${yeni}$2${tr}$3`],
  [P.ver, /("version":\s*")\d+\.\d+\.\d+(")/, `$1${yeni}$2`],
  [P.ver, /("date":\s*")[^"]*(")/, `$1${iso}$2`],
  [P.sw, /(const V = 'izsiz-v)\d+\.\d+\.\d+(')/, `$1${yeni}$2`],
];
const buf = {};
for (const [f, re, rep] of edits) {
  buf[f] = buf[f] ?? read(f);
  if (!re.test(buf[f])) { console.error(`${path.basename(f)} içinde eşleşme yok: ${re}`); process.exit(1); }
  buf[f] = buf[f].replace(re, rep);
}
for (const f in buf) fs.writeFileSync(f, buf[f]);
console.log(`Sürüm ${mevcut} → ${yeni} (${tr})`);
console.log('  index.html · version.json · sw.js güncellendi');

const t = spawnSync(process.execPath, [path.join(dir, 'tests', 'test.js')], { stdio: 'inherit' });
if (t.status !== 0) { console.error('Testler başarısız oldu; yüklemeden önce kontrol et.'); process.exit(1); }
console.log('\nŞimdi şu üç dosyayı sunucuya yükle: index.html, sw.js, version.json');
