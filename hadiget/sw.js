// Uygulama kabuğunu önbelleğe alır; ilk yüklemeden sonra internet olmadan da
// açılır (aynı Wi-Fi ağında internet olmasa bile aktarım çalışır).
// Sürüm değişince VERSION'ı artırın.
const VERSION = 'hadiget-v2';
const ASSETS = [
  './',
  'index.html',
  'nasil-kullanilir.html',
  'gizlilik.html',
  'kosullar.html',
  'style.css',
  'app.js',
  'peer.js',
  'signal.js',
  'qr.js',
  'scan.js',
  'vendor/qrcode-generator.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => Promise.all(ASSETS.map((a) => c.add(a).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Önce önbellek, arkada güncelle.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
