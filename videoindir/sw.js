"use strict";
importScripts("config.js"); // sürüm tek kaynaktan: config.js

const CACHE = "forge-" + self.FORGE_CONFIG.version;
const SHELL = [
  "./",
  "index.html",
  "legal.html",
  "style.css",
  "config.js",
  "app.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // API ve video istekleri (başka kaynaklar) her zaman doğrudan ağdan gider; önbelleğe alınmaz.
  if (req.method !== "GET" || url.origin !== location.origin) return;

  // Uygulama kabuğu: önce ağ, olmazsa önbellek.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("index.html")))
  );
});
