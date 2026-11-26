import { cp, mkdir, rm } from 'node:fs/promises';

const output = new URL('./public/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'sw.js', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'manus-routes.json']) {
  await cp(new URL(`./${file}`, import.meta.url), new URL(`./public/${file}`, import.meta.url));
}
console.log(`Pikselce static output ready: ${output.pathname}`);
