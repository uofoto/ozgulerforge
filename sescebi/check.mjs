import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

let failed = false;
const fail = (message) => { console.error('HATA:', message); failed = true; };

for (const file of ['main.js', 'cloud-sync.js', 'sw.js', 'scripts/build.mjs', 'scripts/server.mjs']) {
  try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); }
  catch (error) { fail(`${file} sözdizimi hatalı:\n${error.stderr}`); }
}

const main = await readFile('main.js', 'utf8');
const sw = await readFile('sw.js', 'utf8');
const appVersion = main.match(/const APP_VERSION = '([^']+)'/)?.[1];
const swVersion = sw.match(/const VERSION = '([^']+)'/)?.[1];
if (!appVersion || !swVersion) fail('APP_VERSION (main.js) veya VERSION (sw.js) bulunamadı.');
else if (appVersion !== swVersion) fail(`Sürüm uyuşmuyor: main.js=${appVersion}, sw.js=${swVersion}`);

// get('...') ile aranan her id şablonda tanımlı olmalı (eksikse uygulama açılışta hata verir).
const ids = new Set([...main.matchAll(/\bid="([^"$]+)"/g)].map((m) => m[1]));
const missing = [...new Set([...main.matchAll(/\bget\('([^']+)'\)/g)].map((m) => m[1]))].filter((id) => !ids.has(id) && !['content-length', 'content-type', 'x-file-name'].includes(id));
if (missing.length) fail(`Şablonda olmayan id'ler: ${missing.join(', ')}`);

if (failed) process.exit(1);
console.log(`Kontroller geçti (sürüm ${appVersion}).`);
