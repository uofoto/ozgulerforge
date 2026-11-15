const CACHE_NAME = 'formatlab-shell-v3';
const APP_BASE = new URL(self.registration.scope);
const appFile = (name) => new URL(name, APP_BASE).href;
const APP_ROOT = APP_BASE.href;
const INDEX_URL = appFile('index.html');
const APP_SHELL = [APP_ROOT, INDEX_URL, appFile('manifest.webmanifest'), appFile('icon.svg'), appFile('icon-192.png'), appFile('icon-512.png'), appFile('icon-maskable-512.png')];
const ASSET_PREFIX = new URL('assets/', APP_BASE).pathname;
const SERVICE_WORKER_PATH = new URL('sw.js', APP_BASE).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('formatlab-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then(async (cache) => {
        await cache.put(request, response.clone());
        await cache.put(INDEX_URL, response.clone());
      });
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match(INDEX_URL)) || (await caches.match(APP_ROOT))));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok && (url.pathname.startsWith(ASSET_PREFIX) || url.pathname === SERVICE_WORKER_PATH)) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});
