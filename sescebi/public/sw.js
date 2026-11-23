const CACHE_NAME = 'sescebi-shell-v33';
// Hangi alt klasörde yayınlanırsa (ör. /sescebi/) onun kapsamını kullanır.
const BASE = self.registration.scope;
const scoped = (path) => new URL(path, BASE).href;
const APP_SHELL = ['./', 'index.html', 'manifest.webmanifest', 'manus-routes.json', 'lame.min.js', 'cloud-sync.js', 'editorial-v33.css?v=33', 'main.js?v=33', 'icons/icon-192.svg', 'icons/icon-512.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png'].map(scoped);

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(scoped('./?sw-shell=33'), { cache: 'no-store' });
  const html = await response.clone().text();
  const assets = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)].map((match) => new URL(match[1], BASE).href);
  const urls = [...new Set([...APP_SHELL, ...assets])];
  // Tek bir dosya hata verirse tüm kurulum bozulmasın.
  await Promise.allSettled(urls.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
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

async function handleShare(request) {
  try {
    const form = await request.formData();
    const file = form.getAll('media').find((item) => typeof item !== 'string');
    if (file) {
      const cache = await caches.open('sescebi-share');
      await cache.put(scoped('shared-file'), new Response(file, { headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-file-name': encodeURIComponent(file.name || 'paylasilan-dosya') } }));
    }
  } catch {
    // Paylaşılan dosya alınamazsa uygulama yine de açılır.
  }
  return Response.redirect(scoped('./?shared=1'), 303);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('sescebi-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method === 'POST' && requestUrl.href === scoped('share-target')) {
    event.respondWith(handleShare(event.request));
    return;
  }
  if (event.request.method !== 'GET') return;
  if (requestUrl.origin !== self.location.origin) return;

  const isDocument = event.request.mode === 'navigate' || requestUrl.href === scoped('./') || requestUrl.href === scoped('index.html') || requestUrl.href === scoped('sw.js');
  event.respondWith(isDocument ? networkFirst(event.request) : cacheFirst(event.request));
});
