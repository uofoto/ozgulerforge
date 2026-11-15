const VERSION = 'kontak-v2';
const SHELL = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'js/app.js', 'js/engine.js', 'js/formats.js', 'js/zip.js',
  'vendor/ffmpeg/index.js', 'vendor/ffmpeg/classes.js', 'vendor/ffmpeg/const.js', 'vendor/ffmpeg/errors.js', 'vendor/ffmpeg/utils.js', 'vendor/ffmpeg/types.js', 'vendor/ffmpeg/worker.js',
  'vendor/core/ffmpeg-core.js', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
const BIG = ['vendor/core/ffmpeg-core.wasm'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
    self.skipWaiting();
    // 32 MB'lık wasm kurulumu engellemesin; arka planda indirilir.
    e.waitUntil?.(Promise.resolve());
    for (const u of BIG) { try { await c.add(u); } catch {} }
    const cl = await self.clients.matchAll(); cl.forEach(x => x.postMessage({ type: 'precached' }));
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const hit = await caches.match(r, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(r);
      if (res.ok) (await caches.open(VERSION)).put(r, res.clone());
      return res;
    } catch {
      if (r.mode === 'navigate') return (await caches.match('index.html')) || Response.error();
      return Response.error();
    }
  })());
});
