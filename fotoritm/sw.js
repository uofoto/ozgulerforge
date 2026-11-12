const V = 'foto-ritim-v4.0.0';
const A = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable.png',
  'apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V).then(c => Promise.all(A.map(u => c.add(u).catch(() => 0))))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x))))
      .then(() => clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skip') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(r, { ignoreSearch: true }).then(h => {
      const n = fetch(r)
        .then(x => {
          if (x.ok) caches.open(V).then(c => c.put(r, x.clone()));
          return x;
        })
        .catch(() => h || caches.match('index.html'));
      return h || n;
    })
  );
});