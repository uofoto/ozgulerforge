// Uygulama kabuğunu önbelleğe alır; ilk yüklemeden sonra internet olmadan da
// açılır (aynı Wi-Fi ağında internet olmasa bile aktarım çalışır).
// Yayında değişiklik yaparsanız version.js içindeki sürümü artırın.
importScripts('version.js'); // sürüm numarası tek yerde: version.js
const VERSION = 'hadiget-v' + self.APP_VERSION;
const SHARE = 'hadiget-share'; // paylaşım menüsünden gelen dosyalar geçici olarak burada beklenir
const ASSETS = [
  './',
  'index.html',
  'nasil-kullanilir.html',
  'gizlilik.html',
  'kosullar.html',
  'style.css',
  'version.js',
  'i18n.js',
  'zip.js',
  'editor.js',
  'app.js',
  'peer.js',
  'signal.js',
  'discover.js',
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
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== SHARE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Paylaşım menüsünden (Web Share Target) gelen dosyaları al, uygulamaya yönlendir.
async function takeShare(req) {
  try {
    const form = await req.formData();
    const cache = await caches.open(SHARE);
    for (const k of await cache.keys()) await cache.delete(k);
    let i = 0;
    for (const f of form.getAll('files')) {
      if (!(f instanceof File)) continue;
      await cache.put(
        new Request(new URL('__share/' + i++, self.registration.scope).href),
        new Response(f, { headers: { 'X-Name': encodeURIComponent(f.name), 'X-Type': f.type || '' } })
      );
    }
    const text = [form.get('title'), form.get('text'), form.get('url')].filter((x) => typeof x === 'string' && x).join('\n');
    if (text) await cache.put(new Request(new URL('__share/text', self.registration.scope).href), new Response(text));
  } catch {}
  return Response.redirect(new URL('./?share=1', self.registration.scope).href, 303);
}

// Önce önbellek, arkada güncelle.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method === 'POST' && new URL(req.url).pathname.endsWith('/share-target')) {
    e.respondWith(takeShare(req));
    return;
  }
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
