// Sürümü ve import haritasını tek komutla günceller.
//   node tools/bump-version.mjs 6.9.44     → config.js'teki APP_VERSION, index.html'deki ?v= değerleri ve import haritası
//   node tools/bump-version.mjs --check    → her şey eşleşiyor mu? (eşleşmiyorsa 1 ile çıkar; `npm test` bunu çalıştırır)
//
// Neden: Modüller tarayıcı önbelleğinde eski kalırsa index.html yeni, alt modüller eski olabilir (sürüm karışıklığı).
// Import haritası her modülün adresine ?v=<sürüm> ekleyerek hepsini birlikte yeniler.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = new Set(['app.js', 'cloud.js', 'forge-mark.js', 'sw.js']);   // <script> ile yüklenenler; haritaya girmez
const START = '<!-- importmap:start -->', END = '<!-- importmap:end -->';

function modules() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name), rel = relative(ROOT, p).split('\\').join('/');
      if (statSync(p).isDirectory()) { if (name === 'engines' || name === 'intelligence') walk(p); else if (dir !== ROOT) walk(p); continue; }
      if (!name.endsWith('.js')) continue;
      if (dir === ROOT && ENTRY.has(name)) continue;
      out.push('./' + rel);
    }
  };
  walk(ROOT);
  // walk() kök dizinde yalnızca engines/ ve intelligence/ klasörlerine iner (tests/, tools/, node_modules/ taranmaz)
  return out.sort();
}

function importMapBlock(ver) {
  const imports = {};
  for (const m of modules()) imports[m] = `${m}?v=${ver}`;
  const json = JSON.stringify({ imports }, null, 2).split('\n').map(l => '    ' + l).join('\n');
  return `${START}\n  <script type="importmap">\n${json}\n  </script>\n  ${END}`;
}

function currentVersion() {
  const m = /export const APP_VERSION = '([^']+)'/.exec(readFileSync(join(ROOT, 'config.js'), 'utf8'));
  if (!m) throw new Error('config.js içinde APP_VERSION bulunamadı');
  return m[1];
}

function render(ver) {
  const cfg = readFileSync(join(ROOT, 'config.js'), 'utf8').replace(/(export const APP_VERSION = ')[^']+(')/, `$1${ver}$2`);
  let html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a < 0 || b < 0) throw new Error('index.html içinde importmap işaretleri yok');
  html = html.slice(0, a) + importMapBlock(ver) + html.slice(b + END.length);
  html = html.replace(/(\.(?:js|css))\?v=\d+\.\d+\.\d+(["'])/g, `$1?v=${ver}$2`);
  html = html.replace(/(data-app-version[^>]*>)v\d+\.\d+\.\d+(<)/g, `$1v${ver}$2`);   // ilk açılışta görünen sürüm etiketleri
  return { cfg, html };
}

const arg = process.argv[2];
if (!arg) { console.log('Kullanım: node tools/bump-version.mjs <sürüm> | --check'); process.exit(2); }
if (arg === '--check') {
  const ver = currentVersion(), want = render(ver);
  const okCfg = want.cfg === readFileSync(join(ROOT, 'config.js'), 'utf8');
  const okHtml = want.html === readFileSync(join(ROOT, 'index.html'), 'utf8');
  if (okCfg && okHtml) { console.log(`Tamam: sürüm ${ver}, import haritası güncel.`); process.exit(0); }
  console.error(`index.html import haritası/sürümleri güncel değil. Düzeltmek için: node tools/bump-version.mjs ${ver}`);
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+$/.test(arg)) { console.error('Sürüm 6.9.44 biçiminde olmalı'); process.exit(2); }
const { cfg, html } = render(arg);
writeFileSync(join(ROOT, 'config.js'), cfg); writeFileSync(join(ROOT, 'index.html'), html);
console.log(`Sürüm ${arg} olarak güncellendi (${modules().length} modül haritada).`);
