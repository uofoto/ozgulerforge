// Ses Cebi · İsteğe bağlı Google ile Bulut Eşitleme (Cloudflare Worker)
(function () {
  const WORKER_BASE = 'https://sescebi-sync.uozguler.workers.dev';
  const GOOGLE_CLIENT_ID = '296134935455-j9053t8sh8a0rht7e86o82l7051v6e2q.apps.googleusercontent.com';
  const TOKEN_KEY = 'sescebi.cloud.token.v1';
  const USER_KEY = 'sescebi.cloud.user.v1';
  const LAST_SYNC_KEY = 'sescebi.cloud.lastSync.v1';

  let gsiReady = false;
  let tokenClient = null;
  let syncing = false;

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch {
      return '';
    }
  }

  function setToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setUser(user) {
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_KEY);
    } catch {}
  }

  function getLastSync() {
    try {
      return localStorage.getItem(LAST_SYNC_KEY) || '';
    } catch {
      return '';
    }
  }

  function setLastSync(ts) {
    try {
      if (ts) localStorage.setItem(LAST_SYNC_KEY, ts);
      else localStorage.removeItem(LAST_SYNC_KEY);
    } catch {}
  }

  function notify(msg) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg);
      return;
    }
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(window.__sescebiToastTimer);
    window.__sescebiToastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
  }

  // hadiGET Şık 2 Adımlı Onay Kartı (Tarayıcı confirm() yerine)
  function showHadigetConfirmModal() {
    return new Promise((resolve) => {
      const existing = document.getElementById('hg-cloud-confirm-overlay');
      if (existing) existing.remove();

      let step = 1;
      const overlay = document.createElement('div');
      overlay.id = 'hg-cloud-confirm-overlay';
      overlay.className = 'hg-confirm-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');

      overlay.innerHTML = `
        <div class="hg-confirm-card">
          <div class="hg-confirm-head">
            <div class="hg-confirm-brand">
              <span class="hg-confirm-logo">hG</span>
              <div>
                <strong class="hg-confirm-brand-name">hadiGET · Ses Cebi</strong>
                <span class="hg-confirm-step" id="hg-confirm-step">1. ADIM / 2 ADIM ONAY</span>
              </div>
            </div>
            <button type="button" class="hg-confirm-close" id="hg-confirm-close" aria-label="Kapat">✕</button>
          </div>

          <div class="hg-confirm-body">
            <h3 class="hg-confirm-title" id="hg-confirm-title">Bulut yedeğin silinsin mi?</h3>
            <p class="hg-confirm-desc" id="hg-confirm-desc">
              Buluttaki tüm favori işaretlerin ve dinleme istatistiklerin kaldırılacak. Cihazındaki ses kayıtları bu işlemden etkilenmez.
            </p>
          </div>

          <div class="hg-confirm-actions">
            <button type="button" class="hg-btn-cancel" id="hg-confirm-cancel">Vazgeç</button>
            <button type="button" class="hg-btn-proceed" id="hg-confirm-proceed">Devam et (1/2)</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('is-open'));

      const cleanup = (result) => {
        overlay.classList.remove('is-open');
        setTimeout(() => overlay.remove(), 180);
        resolve(result);
      };

      overlay.querySelector('#hg-confirm-close').addEventListener('click', () => cleanup(false));
      overlay.querySelector('#hg-confirm-cancel').addEventListener('click', () => cleanup(false));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(false);
      });

      overlay.querySelector('#hg-confirm-proceed').addEventListener('click', () => {
        if (step === 1) {
          step = 2;
          overlay.querySelector('#hg-confirm-step').textContent = '2. SON ONAY · GERİ ALINAMAZ';
          overlay.querySelector('#hg-confirm-title').textContent = 'Kalıcı silme işlemini onayla';
          overlay.querySelector('#hg-confirm-desc').textContent =
            'Bu işlemden sonra buluttaki eşitleme verilerin geri getirilemez. Silmek istediğine emin misin?';
          const btn = overlay.querySelector('#hg-confirm-proceed');
          btn.textContent = 'Evet, kalıcı sil';
          btn.classList.add('is-final');
        } else {
          cleanup(true);
        }
      });
    });
  }

  function ensureGsiScript() {
    return new Promise((resolve) => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        gsiReady = true;
        resolve(true);
        return;
      }
      const existing = document.querySelector('script[data-gsi-client="1"]');
      if (existing) {
        existing.addEventListener('load', () => {
          gsiReady = true;
          resolve(true);
        });
        existing.addEventListener('error', () => resolve(false));
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.dataset.gsiClient = '1';
      s.onload = () => {
        gsiReady = true;
        resolve(true);
      };
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  async function initGoogleSignIn() {
    const ok = await ensureGsiScript();
    if (!ok || !window.google?.accounts?.oauth2) {
      notify('Google kimlik servisi yüklenemedi. İnternet bağlantını kontrol et.');
      return;
    }

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: async (resp) => {
        if (!resp || resp.error || !resp.access_token) {
          notify('Google girişi tamamlanamadı.');
          return;
        }
        try {
          const authRes = await fetch(`${WORKER_BASE}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: resp.access_token })
          });
          const data = await authRes.json();
          if (!authRes.ok || !data.token) {
            notify(data.error || 'Bulut oturumu açılamadı.');
            return;
          }
          setToken(data.token);
          setUser(data.user || { email: 'Google hesabı' });
          renderCloudControls();
          notify('Gmail hesabı bağlandı.');
          await syncNow(true);
        } catch {
          notify('Bulut sunucusuna ulaşılamadı.');
        }
      }
    });

    tokenClient.requestAccessToken({ prompt: 'select_account' });
  }

  async function syncNow(silent = false) {
    const token = getToken();
    if (!token || syncing) return;
    syncing = true;
    renderCloudControls();

    try {
      const localPayload =
        typeof window.exportCloudSyncState === 'function'
          ? await window.exportCloudSyncState()
          : { favorites: [], stats: {} };

      const res = await fetch(`${WORKER_BASE}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(localPayload)
      });

      if (res.status === 401) {
        signOutCloud(true);
        notify('Bulut oturumu sona erdi, lütfen yeniden giriş yap.');
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        if (!silent) notify(data.error || 'Bulut eşitleme başarısız.');
        return;
      }

      if (data.state && typeof window.importCloudSyncState === 'function') {
        await window.importCloudSyncState(data.state);
      }

      const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      setLastSync(now);
      if (!silent) notify('Yedek buluta gönderildi ve eşitlendi.');
    } catch {
      if (!silent) notify('Çevrimdışı: Bulut eşitleme ertelendi.');
    } finally {
      syncing = false;
      renderCloudControls();
    }
  }

  function signOutCloud(silent = false) {
    setToken('');
    setUser(null);
    setLastSync('');
    renderCloudControls();
    if (!silent) notify('Google hesabından çıkış yapıldı.');
  }

  async function deleteCloudData() {
    const token = getToken();
    if (!token) return;

    const confirmed = await showHadigetConfirmModal();
    if (!confirmed) return;

    try {
      const res = await fetch(`${WORKER_BASE}/sync`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        notify('Bulut verisi silinemedi.');
        return;
      }
      signOutCloud(true);
      notify('Bulut verilerin kalıcı olarak silindi.');
    } catch {
      notify('Bulut sunucusuna ulaşılamadı.');
    }
  }

  function renderCloudControls() {
    const user = getUser();
    const token = getToken();
    const lastSync = getLastSync();
    const isConnected = Boolean(token && user);

    // 1. Yedek & Özet Çekmecesi İçi Bulut Alanı
    const drawerHost = document.getElementById('cloud-sync-box');
    if (drawerHost) {
      if (!isConnected) {
        drawerHost.innerHTML = `
          <div class="cloud-sync-row">
            <button type="button" class="primary-button" data-cloud-action="login">
              Gmail ile giriş yap
            </button>
          </div>
          <p class="cloud-sync-hint">
            Favori listen ve dinleme istatistiklerin Google hesabınla eşitlenir; ses dosyaların "Yedeği cihazda sakla" ile ZIP olarak cihazında tutulur.
          </p>
        `;
      } else {
        drawerHost.innerHTML = `
          <div class="cloud-sync-status">
            <strong>Bulut yedek açık: ${user.email || 'Google hesabı'}</strong>
            <span>${lastSync ? ` · Son gönderim ${lastSync}` : ''}</span>
          </div>
          <div class="cloud-sync-row">
            <button type="button" class="primary-button" data-cloud-action="sync" ${syncing ? 'disabled' : ''}>
              ${syncing ? 'Gönderiliyor…' : 'Yedeği buluta gönder'}
            </button>
            <button type="button" class="ghost-button" data-cloud-action="logout">
              Çıkış yap
            </button>
            <button type="button" class="ghost-button is-danger-ghost" data-cloud-action="delete">
              Bulut verimi sil
            </button>
          </div>
          <p class="cloud-sync-hint">
            Not: "Yedeği buluta gönder" favori ve dinleme verilerini Google hesabına kaydeder; ses dosyaları ise "Yedeği cihazda sakla" ile ZIP olarak cihazında tutulur.
          </p>
        `;
      }
    }

    // 2. Ana Ekranda Belirgin Gmail Hesap Çubuğu
    const bannerHost = document.getElementById('home-account-bar');
    if (bannerHost) {
      if (!isConnected) {
        bannerHost.innerHTML = `
          <div class="account-bar-info">
            <span class="account-avatar">G</span>
            <div class="account-text">
              <strong>Gmail ile giriş yapılmadı</strong>
              <span>Favori ve dinleme verilerini yedeklemek için bağlan</span>
            </div>
          </div>
          <button type="button" class="primary-button account-bar-btn" data-cloud-action="login">
            Gmail ile giriş
          </button>
        `;
      } else {
        const initials = (user.name || user.email || 'G').slice(0, 1).toUpperCase();
        bannerHost.innerHTML = `
          <div class="account-bar-info">
            <span class="account-avatar is-connected">${initials}</span>
            <div class="account-text">
              <strong>${user.name || 'Google Hesabı'} <span class="account-pill">Bağlı</span></strong>
              <span>${user.email || ''}${lastSync ? ` · Son yedek ${lastSync}` : ''}</span>
            </div>
          </div>
          <div class="account-bar-actions">
            <button type="button" class="ghost-button account-bar-btn" data-cloud-action="sync" ${syncing ? 'disabled' : ''}>
              ${syncing ? 'Gönderiliyor…' : 'Yedeği buluta gönder'}
            </button>
          </div>
        `;
      }
    }

    // 3. Masaüstü Sol Menü Altı Hesap Kartı
    const railHost = document.getElementById('rail-account-card');
    if (railHost) {
      if (!isConnected) {
        railHost.innerHTML = `
          <button type="button" class="rail-login-btn" data-cloud-action="login">
            <span class="rail-avatar">G</span>
            <span class="rail-account-meta">
              <strong>Gmail ile giriş</strong>
              <small>Bulut yedek kapalı</small>
            </span>
          </button>
        `;
      } else {
        const initials = (user.name || user.email || 'G').slice(0, 1).toUpperCase();
        railHost.innerHTML = `
          <div class="rail-user-box">
            <span class="rail-avatar is-connected">${initials}</span>
            <span class="rail-account-meta">
              <strong>${user.name || 'Google Hesabı'}</strong>
              <small>${user.email || ''}</small>
            </span>
          </div>
        `;
      }
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cloud-action]');
    if (!btn) return;
    const action = btn.dataset.cloudAction;
    if (action === 'login') initGoogleSignIn();
    else if (action === 'sync') syncNow(false);
    else if (action === 'logout') signOutCloud(false);
    else if (action === 'delete') deleteCloudData();
  });

  window.SesCebiCloud = {
    render: renderCloudControls,
    syncNow
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderCloudControls);
  } else {
    renderCloudControls();
  }
})();