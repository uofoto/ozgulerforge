const CACHE_NAME = 'filigran-shell-8fa4cce363-r4';
const ROOT = new URL('./', self.registration.scope).toString();
const PRECACHE = [".", "assets/UTIF-DE_fZg9J.js", "assets/UTIF-D_Egx2_X.js", "assets/commonjs-dynamic-modules-CGE348Hf.js", "assets/dm-mono-latin-400-normal-Du9W-GAy.woff2", "assets/dm-mono-latin-500-normal-CLN5ozUA.woff2", "assets/dm-mono-latin-ext-400-normal-CPKZr-9B.woff2", "assets/dm-mono-latin-ext-500-normal-DJqo96_E.woff2", "assets/dm-sans-latin-400-normal-COF6noiJ.woff2", "assets/dm-sans-latin-500-normal-kGSpR5A9.woff2", "assets/dm-sans-latin-600-normal-DrBIvsIy.woff2", "assets/dm-sans-latin-700-normal-1DREuLwQ.woff2", "assets/dm-sans-latin-ext-400-normal-Cygz-XR6.woff2", "assets/dm-sans-latin-ext-500-normal-BBd_G3i-.woff2", "assets/dm-sans-latin-ext-600-normal-CFRgRepe.woff2", "assets/dm-sans-latin-ext-700-normal-CGQ_Vo0j.woff2", "assets/image.worker-DUEu8L13.js", "assets/index--lcDaCVD.js", "assets/index-br10sDnU.css", "assets/playfair-display-latin-600-italic-DUHhWHzL.woff2", "assets/playfair-display-latin-600-normal-CHZ-UWfP.woff2", "assets/playfair-display-latin-700-italic-DnvGFUOX.woff2", "assets/playfair-display-latin-700-normal-CtHl6EpB.woff2", "assets/playfair-display-latin-ext-600-italic-BMMU2VFS.woff2", "assets/playfair-display-latin-ext-600-normal-Ce0DF62x.woff2", "assets/playfair-display-latin-ext-700-italic-BuOqpLMf.woff2", "assets/playfair-display-latin-ext-700-normal-DfIbajr-.woff2", "assets/wasm-bundle-CBw2mUBK.js", "assets/wasm-bundle-DZK6tB_W.js", "filigran-mark-192.png", "filigran-mark-512.png", "filigran-mark.svg", "index.html", "manifest.webmanifest", "pwa-fix.js"].map((file) => file === '.' ? ROOT : new URL(file, ROOT).toString());

// Kabuk dosyaları (sayfa, manifest) zorunlu; diğerleri eksik olsa bile servis worker kurulur.
const REQUIRED = [ROOT, new URL('index.html', ROOT).toString(), new URL('manifest.webmanifest', ROOT).toString()];
const INDEX_URL = new URL('index.html', ROOT).toString();
// Hash'siz (adı değişmeyen) dosyalar: her zaman önce ağdan alınır, böylece güncellemeler hemen görünür.
const NETWORK_FIRST_FILES = [new URL('pwa-fix.js', ROOT).toString(), new URL('manifest.webmanifest', ROOT).toString()];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const results = await Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
      const failedRequired = results.some((r, i) => r.status === 'rejected' && REQUIRED.includes(PRECACHE[i]));
      if (failedRequired) throw new Error('Zorunlu kabuk dosyaları önbelleğe alınamadı');
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('filigran-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'GET_VERSION' && event.source) event.source.postMessage({ type: 'VERSION', version: CACHE_NAME });
});

function cachedShell() {
  // Yalnızca bu sürümün önbelleğine bak (eski sürümlerin sayfası gelmesin).
  return caches.open(CACHE_NAME).then((c) => c.match(ROOT).then((r) => r || c.match(INDEX_URL)));
}

function isAppShell(url) {
  const u = new URL(url);
  const root = new URL(ROOT);
  return u.pathname === root.pathname || u.pathname === new URL(INDEX_URL).pathname;
}

function networkFirst(request) {
  const url = new URL(request.url);
  const forceFresh = url.searchParams.has('updated'); // "Güncelle" düğmesinden geldi: eski sayfaya düşme
  const shell = isAppShell(request.url);
  return new Promise((resolve) => {
    let settled = false;
    const fallback = () => (shell ? cachedShell() : caches.open(CACHE_NAME).then((c) => c.match(request.url))
      .then((r) => r || cachedShell())).then((cached) => cached || Response.error());
    const timer = forceFresh ? null : setTimeout(() => { if (!settled) { settled = true; fallback().then(resolve); } }, 8000);
    fetch(request.url, { cache: 'reload' }).then((response) => {
      if (timer) clearTimeout(timer);
      // Sadece uygulama sayfası ana önbelleğe yazılır (gizlilik vb. sayfalar ezmesin).
      if (response.ok && shell) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(ROOT, copy));
      }
      if (!settled) { settled = true; resolve(response.ok || response.status !== 404 ? response : fallback()); }
    }).catch(() => {
      if (timer) clearTimeout(timer);
      if (!settled) { settled = true; fallback().then(resolve); }
    });
  });
}

function networkFirstFile(request) {
  return fetch(request, { cache: 'reload' }).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    }
    return caches.open(CACHE_NAME).then((c) => c.match(request)).then((cached) => cached || response);
  }).catch(() => caches.open(CACHE_NAME).then((c) => c.match(request)).then((cached) => cached || new Response('', { status: 504, statusText: 'Offline' })));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (NETWORK_FIRST_FILES.includes(url.origin + url.pathname)) {
    event.respondWith(networkFirstFile(request));
    return;
  }
  // Hash'li dosyalar (assets/*): adı içeriğiyle değiştiği için önce önbellek güvenlidir.
  event.respondWith(
    caches.open(CACHE_NAME).then((c) => c.match(request)).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => new Response('', { status: 504, statusText: 'Offline' }))),
  );
});
