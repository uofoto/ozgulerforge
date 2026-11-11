const CACHE_NAME = 'sescebi-shell-v8';
// Service worker hangi alt klasörde yayınlanırsa onun kapsamını kullanır (örn. /sescebi/).
const BASE = self.registration.scope;
const scoped = (path) => new URL(path, BASE).href;
const APP_SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'manus-routes.json',
  'icons/icon-192.svg',
  'icons/icon-512.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png'
].map(scoped);

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(scoped('./?sw-shell=8'), { cache: 'no-store' });
  const html = await response.clone().text();
  const assets = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)].map((match) => new URL(match[1], BASE).href);
  const urls = [...new Set([...APP_SHELL, ...assets])];
  // Tek bir dosya hata verirse tüm kurulum bozulmasın.
  await Promise.allSettled(urls.map((url) => cache.add(url)));
}

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch {
    return caches.match(request).then((cached) => cached || caches.match(scoped('./')));
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const isDocument =
    event.request.mode === 'navigate' ||
    requestUrl.href === scoped('./') ||
    requestUrl.href === scoped('index.html') ||
    requestUrl.href === scoped('sw.js');
  event.respondWith(isDocument ? networkFirst(event.request) : cacheFirst(event.request));
});
