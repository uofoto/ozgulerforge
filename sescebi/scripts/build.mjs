import { cp, mkdir, rm, copyFile } from 'node:fs/promises';

const files = ['index.html', 'main.js', 'styles.css', 'manifest.webmanifest', 'sw.js', 'manus-routes.json'];
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of files) await copyFile(file, `dist/${file}`);
await cp('icons', 'dist/icons', { recursive: true });
console.log('Ses Cebi Premium: statik PWA paketi dist/ klasörüne hazırlandı.');
