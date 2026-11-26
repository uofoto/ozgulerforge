const VERSION = 'kontak-v2.6.1';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/app.js',
  'js/engine.js',
  'js/formats.js',
  'js/zip.js',
  'js/pdf-tools.js',
  'vendor/pdf-lib/pdf-lib.min.js',
  'vendor/pdfjs/pdf.min.mjs',
  'vendor/pdfjs/pdf.worker.min.mjs',
  'vendor/ffmpeg/index.js',
  'vendor/ffmpeg/classes.js',
  'vendor/ffmpeg/const.js',
  'vendor/ffmpeg/errors.js',
  'vendor/ffmpeg/utils.js',
  'vendor/ffmpeg/types.js',
  'vendor/ffmpeg/worker.js',
  'vendor/core/ffmpeg-core.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png'
];
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
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data?.type === 'cache-core') {
    e.waitUntil((async () => {
      const c = await caches.open(VERSION);
      for (const u of BIG) {
        const hit = await c.match(u);
        if (!hit) {
          try {
            const res = await fetch(u, { cache: 'no-cache' });
            if (res.ok && !isHtml(res)) await c.put(u, res);
          } catch {}
        }
      }
      const clients = await self.clients.matchAll();
      clients.forEach(cl => cl.postMessage({ type: 'precached' }));
    })());
  }
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (isWasm(req)) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && !isHtml(res)) c.put(req, res.clone());
      return res;
    })());
    return;
  }

  // Network-first for app shell so updates deploy cleanly; fallback to cache offline
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) {
        if (!isHtml(res) || url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
          c.put(req, res.clone());
        }
        return res;
      }
      throw new Error('Bad status');
    } catch {
      const cached = await c.match(req);
      return cached || Response.error();
    }
  })());
});
