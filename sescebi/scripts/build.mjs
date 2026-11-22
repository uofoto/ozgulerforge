import { cp, mkdir, rm, copyFile } from 'node:fs/promises';

const files = ['index.html', 'main.js', 'styles.css', 'redesign.css', 'manifest.webmanifest', 'sw.js', 'manus-routes.json', 'lame.min.js', 'cloud-sync.js'];
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of files) await copyFile(file, `dist/${file}`);
await cp('icons', 'dist/icons', { recursive: true });
console.log('Ses Cebi: statik PWA paketi dist/ klasörüne hazırlandı.');
