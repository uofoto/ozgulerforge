const CACHE_NAME = 'sescebi-shell-v16';
const BASE = self.registration.scope;
const scoped = (path) => new URL(path, BASE).href;
const APP_SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'manus-routes.json',
  'icons/icon-192.svg', 'icons/icon-512.svg',
  'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png'
].map(scoped);

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const page = await fetch(scoped('./?sw-shell=16'), { cache: 'no-store' });
  if (!page.ok) throw new Error('Uygulama ana sayfası önbelleğe alınamadı.');
  const html = await page.clone().text();
  const assets = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)]
    .map((match) => new URL(match[1], BASE).href);

  // Uygulama kodu ve stiller kritik: bunlar alınamazsa yeni SW kurulmasın.
  await Promise.all(assets.map(async (url) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Uygulama dosyası alınamadı: ${url}`);
    await cache.put(url, response.clone());
  }));
  await Promise.allSettled(APP_SHELL.map(async (url) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (response.ok) await cache.put(url, response);
  }));
  await cache.put(scoped('./'), page);
}

async function networkFirst(request, fallbackUrl = scoped('./')) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return fallbackUrl ? (await caches.match(fallbackUrl)) || Response.error() : Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
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
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('sescebi-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isNavigation = event.request.mode === 'navigate';
  const isCode = /\.(?:js|css|webmanifest)$/.test(url.pathname);
  event.respondWith(isNavigation ? networkFirst(event.request) : isCode ? networkFirst(event.request, null) : cacheFirst(event.request));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
