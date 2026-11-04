/* Filigran PWA düzeltmesi: yükle + güncelle düğmeleri. Uygulama paketinden bağımsız çalışır. */
(function () {
  'use strict';

  var installEvent = null;
  var updating = false;

  // 1) Yükleme olayını uygulamadan ÖNCE yakala
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installEvent = e;
  });
  window.addEventListener('appinstalled', function () {
    installEvent = null;
    toast('Filigran yüklendi.');
  });

  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches ||
      window.navigator.standalone === true
    );
  }

  // 2) Adres çubuğundaki ?updated=... parametresini temizle
  try {
    var u = new URL(location.href);
    if (u.searchParams.has('updated')) {
      u.searchParams.delete('updated');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    }
  } catch (e) {}

  // 3) Servis worker kaydı (sw.js kontrolü HTTP önbelleğine takılmasın)
  var regPromise = null;
  if ('serviceWorker' in navigator) {
    regPromise = navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .catch(function () { return null; });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        regPromise.then(function (r) { if (r) r.update().catch(function () {}); });
      }
    });
  }

  // 4) Küçük bildirim
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.setAttribute('role', 'status');
      toastEl.style.cssText =
        'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;' +
        'max-width:min(92vw,520px);padding:14px 18px;border-radius:14px;background:#1f2421;color:#f4f0e9;' +
        'font:500 14px/1.5 "DM Sans",system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3)';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.style.display = 'none'; }, 7000);
  }

  // 5) Düğme metnine göre türü bul
  function kindOf(el) {
    var btn = el.closest && el.closest('button, a, [role="button"]');
    if (!btn) return null;
    var t = (btn.textContent || '').toLocaleLowerCase('tr').replace(/[+\s]+/g, ' ').trim();
    if (t === 'yükle') return { kind: 'install', el: btn };
    if (t === 'güncelle' || t === 'güncelleniyor…' || t === 'güncelleniyor...') return { kind: 'update', el: btn };
    return null;
  }

  // 6) Yükle
  function doInstall() {
    if (isStandalone()) { toast('Filigran zaten uygulama olarak açık.'); return; }
    if (!installEvent) {
      toast('Filigran bu bilgisayarda zaten yüklü görünüyor. Adres çubuğundaki “Uygulamada aç” düğmesini kullanın. Yeniden yüklemek için önce chrome://apps üzerinden kaldırın.');
      return;
    }
    var ev = installEvent;
    installEvent = null;
    ev.prompt();
    ev.userChoice.then(function (c) {
      if (c && c.outcome === 'accepted') toast('Yükleniyor…');
    });
  }

  // 7) Güncelle: yeni sw.js'i ara, devreye girmesini bekle, taze sayfayı yükle
  function doUpdate() {
    if (updating) return;
    updating = true;
    toast('Güncelleniyor…');
    var finish = function () { location.reload(); };

    if (!regPromise) { finish(); return; }
    regPromise.then(function (reg) {
      if (!reg) { finish(); return; }
      var done = false;
      var go = function () { if (!done) { done = true; finish(); } };
      navigator.serviceWorker.addEventListener('controllerchange', go);
      setTimeout(go, 6000);

      reg.update().catch(function () {}).then(function () {
        if (reg.waiting) { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); return; }
        if (reg.installing) {
          reg.installing.addEventListener('statechange', function () {
            if (this.state === 'activated') setTimeout(go, 200);
          });
          return;
        }
        // Yeni sürüm yok: yine de taze (önbelleksiz) yükle
        setTimeout(go, 400);
      });
    });
  }

  // 8) Tıklamaları React'ten ÖNCE yakala (capture) ve kendi mantığımızı çalıştır
  document.addEventListener('click', function (e) {
    var k = kindOf(e.target);
    if (!k) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (k.kind === 'install') doInstall(); else doUpdate();
  }, true);

  // 9) Uygulama olarak açıkken "yükle" düğmesini gizle
  function hideInstallIfStandalone() {
    if (!isStandalone()) return;
    var nodes = document.querySelectorAll('button, a, [role="button"]');
    for (var i = 0; i < nodes.length; i++) {
      var k = kindOf(nodes[i]);
      if (k && k.kind === 'install') nodes[i].style.display = 'none';
    }
  }
  var pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; hideInstallIfStandalone(); }, 200);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
