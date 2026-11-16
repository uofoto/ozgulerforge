const CACHE_NAME = 'forge-ai-studio-v6.9.2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

// Not: skipWaiting() burada otomatik çağrılmaz. Sayfa, kullanıcı meşgul değilken
// (veya "Yenile"ye basınca) { type: 'SKIP_WAITING' } mesajı gönderir.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  // Yapay zeka API'si ve sw.js'in kendisi asla cache'lenmez
  if (url.hostname === 'generativelanguage.googleapis.com') return;
  if (url.hostname === 'accounts.google.com') return;
  if (url.origin === self.location.origin && url.pathname.endsWith('/sw.js')) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Yalnızca tam (200) veya opaque (CDN script/font) yanıtlar cache'lenir; 206 vb. cache.put'ta hata verir
        if (res && (res.status === 200 || res.type === 'opaque')) {
          const copy = res.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {})
          );
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const shell = await caches.match('./index.html');
          if (shell) return shell;
        }
        return Response.error();
      })
  );
});
