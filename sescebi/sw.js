// Ses Cebi Service Worker. Sürüm numarası main.js içindeki APP_VERSION ile aynı olmalıdır (npm run check denetler).
const VERSION = '34';
const CACHE_NAME = `sescebi-shell-v${VERSION}`;
const SHARE_CACHE = 'sescebi-share';
const BASE = self.registration.scope; // alt klasörde (ör. /sescebi/) yayınlansa da doğru çalışır
const scoped = (path) => new URL(path, BASE).href;

// Bunlardan biri indirilemezse kurulum başarısız olur ve tarayıcı daha sonra yeniden dener.
const CORE = ['./', 'index.html', 'app.css', 'main.js', 'cloud-sync.js', 'manifest.webmanifest'].map(scoped);
// Bunlar eksik olursa uygulama yine de çalışır.
const OPTIONAL = ['lame.min.js', 'icons/icon-192.svg', 'icons/icon-512.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png'].map(scoped);

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(CORE.map((url) => new Request(url, { cache: 'reload' })));
  await Promise.allSettled(OPTIONAL.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
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
    const cached = await caches.match(request, { ignoreSearch: true });
    return cached || (await caches.match(scoped('./'))) || Response.error();
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
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(scoped('shared-file'), new Response(file, { headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-file-name': encodeURIComponent(file.name || 'paylasilan-dosya') } }));
    }
  } catch {
    // Paylaşılan dosya alınamazsa uygulama yine de açılır.
  }
  return Response.redirect(scoped('./?shared=1'), 303);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('sescebi-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method === 'POST' && url.href === scoped('share-target')) {
    event.respondWith(handleShare(request));
    return;
  }
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Sayfa, betik ve stil dosyaları her zaman önce ağdan gelir; çevrimdışıyken önbellek kullanılır.
  const fresh = request.mode === 'navigate' || /\.(?:js|css|html|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  event.respondWith(fresh ? networkFirst(request) : cacheFirst(request));
});
