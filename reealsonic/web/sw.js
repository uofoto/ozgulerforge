const CACHE = 'reel-ses-v2';
const SHELL = ['/', '/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  // Önce ağ, olmazsa önbellek (uygulama kabuğu çevrimdışı da açılır)
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('/'))
    )
  );
});
