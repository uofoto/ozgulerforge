import { cp, mkdir, rm, copyFile, access, readFile } from 'node:fs/promises';

const files = ['index.html', 'main.js', 'cloud-sync.js', 'app.css', 'lame.min.js', 'sw.js', 'manifest.webmanifest'];
// manus-routes.json yalnızca Manus barındırması içindir; varsa pakete girer, yoksa sorun olmaz.
const optional = ['manus-routes.json'];
for (const file of files) {
  try { await access(file); } catch { console.error(`HATA: ${file} bulunamadı.`); process.exit(1); }
}
// index.html içinde anılan yerel dosyaların pakette olduğunu doğrula.
const html = await readFile('index.html', 'utf8');
for (const [, ref] of html.matchAll(/(?:src|href)="([^"#:]+\.(?:js|css|webmanifest|png|svg))"/g)) {
  const known = files.includes(ref) || ref.startsWith('icons/');
  if (!known) { console.error(`HATA: index.html içindeki ${ref} dosyası build listesinde yok.`); process.exit(1); }
}
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of files) await copyFile(file, `dist/${file}`);
for (const file of optional) await copyFile(file, `dist/${file}`).catch(() => undefined);
await cp('icons', 'dist/icons', { recursive: true });
console.log('Ses Cebi: statik PWA paketi dist/ klasörüne hazırlandı.');
