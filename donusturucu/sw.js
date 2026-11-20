const VERSION = 'kontak-v1.2.0';
const SHELL = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'js/app.js', 'js/engine.js', 'js/formats.js', 'js/zip.js',
  'vendor/ffmpeg/index.js', 'vendor/ffmpeg/classes.js', 'vendor/ffmpeg/const.js', 'vendor/ffmpeg/errors.js', 'vendor/ffmpeg/utils.js', 'vendor/ffmpeg/types.js', 'vendor/ffmpeg/worker.js',
  'vendor/core/ffmpeg-core.js', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
const BIG = ['vendor/core/ffmpeg-core.wasm'];

const isHtml = res => /text\/html/i.test(res.headers.get('content-type') || '');
const isWasm = r => /\.wasm$/i.test(new URL(r.url).pathname);

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data?.type !== 'cache-core') return;
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    for (const u of BIG) {
      try {
        if (await c.match(u)) continue;
        const res = await fetch(u);
        if (res.ok && !isHtml(res)) await c.put(u, res);
      } catch {}
    }
    const cl = await self.clients.matchAll({ includeUncontrolled: true });
    cl.forEach(x => x.postMessage({ type: 'precached' }));
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const hit = await caches.match(r, { ignoreSearch: true });
    if (hit && !(isWasm(r) && isHtml(hit))) return hit;
    try {
      const res = await fetch(r);
      if (res.ok && res.status === 200 && !(isWasm(r) && isHtml(res))) e.waitUntil(caches.open(VERSION).then(c => c.put(r, res.clone())).catch(() => {}));
      return res;
    } catch {
      if (r.mode === 'navigate') return (await caches.match('index.html')) || Response.error();
      return Response.error();
    }
  })());
});
