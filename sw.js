// Özgüler Forge ana site service worker.
// Alt uygulamalara (/filigran/, /izsizfoto/ vb.) dokunmaz; yalnızca ana sitenin dosyalarını yönetir.
const V = 'ozgulerforge-site-v1';
const CORE = ['/', '/index.html', '/yasal.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('ozgulerforge-site-') && k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const swr = r => caches.open(V).then(c => c.match(r).then(hit => {
  const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}));

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(swr(r));
    return;
  }
  if (u.origin !== location.origin) return;

  const parts = u.pathname.split('/').filter(Boolean);
  const mine = parts.length === 0 || (parts.length === 1 && parts[0].includes('.')) || parts[0] === 'icons';
  if (!mine) return;

  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r)
        .then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; })
        .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('/index.html')))
    );
    return;
  }
  e.respondWith(swr(r));
});
