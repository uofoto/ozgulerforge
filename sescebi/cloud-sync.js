// Ses Cebi bulut eşitleme: favoriler + dinleme istatistikleri -> Cloudflare Worker (KV)
// Ses dosyaları buluta gönderilmez; yalnızca küçük bir JSON gider.

const API = 'https://sescebi-sync.uozguler.workers.dev';
const GOOGLE_CLIENT_ID = '737017356172-b9m6rbst8qk8iphlc257aj5jqbge6lg0.apps.googleusercontent.com';
const SESSION_KEY = 'sescebi-cloud-session';
const FAV_META_KEY = 'sescebi-cloud-fav-meta';
const LAST_SYNC_KEY = 'sescebi-cloud-last-sync';
const PENDING_KEY = 'sescebi-cloud-pending';
const PUSH_DELAY_MS = 20000;

// ---------- saf yardımcılar ----------

export function songKey(song) {
  const name = String(song?.name || '').normalize('NFC').toLocaleLowerCase('tr').trim();
  const seconds = Math.round(Number(song?.duration) || 0);
  return `${name}|${seconds}`;
}

export function mergeData(remote, local) {
  const merged = { v: 1, favorites: {}, stats: {} };
  const rf = remote?.favorites && typeof remote.favorites === 'object' ? remote.favorites : {};
  const lf = local?.favorites && typeof local.favorites === 'object' ? local.favorites : {};
  for (const key of new Set([...Object.keys(rf), ...Object.keys(lf)])) {
    const a = rf[key];
    const b = lf[key];
    if (a && b) merged.favorites[key] = (b.at > a.at || (b.at === a.at && b.fav)) ? b : a;
    else merged.favorites[key] = a || b;
  }
  const rs = remote?.stats && typeof remote.stats === 'object' ? remote.stats : {};
  const ls = local?.stats && typeof local.stats === 'object' ? local.stats : {};
  for (const key of new Set([...Object.keys(rs), ...Object.keys(ls)])) {
    const a = rs[key];
    const b = ls[key];
    if (a && b) {
      merged.stats[key] = {
        name: b.plays >= a.plays ? b.name : a.name,
        plays: Math.max(a.plays || 0, b.plays || 0),
        seconds: Math.max(a.seconds || 0, b.seconds || 0),
      };
    } else merged.stats[key] = a || b;
  }
  return merged;
}

function stable(data) {
  const sortObject = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  return JSON.stringify({ favorites: sortObject(data.favorites || {}), stats: sortObject(data.stats || {}) });
}

// ---------- ana modül ----------

export function initCloudSync({ getSongs, getStats, saveSong, persistStats, refresh, toast, saveFile }) {
  // Arşivde henüz karşılığı olmayan favori/dinleme kayıtları da cihazda saklanır; ses sonradan gelince otomatik eşleşir.
  function loadPending() {
    try {
      const raw = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
      if (raw && typeof raw === 'object') return { v: 1, favorites: raw.favorites || {}, stats: raw.stats || {} };
    } catch { /* bozuk kayıt */ }
    return { v: 1, favorites: {}, stats: {} };
  }
  function setState(value) {
    state = value;
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(value)); } catch { /* depolama dolu olabilir */ }
  }
  let state = loadPending();
  let session = loadSession();
  let applying = false;
  let syncing = false;
  let rerun = false;
  let timer = 0;
  let lastCount = getSongs().length;
  let busy = false;
  let box = null;
  let consentGiven = false;

  function loadSession() {
    try {
      const raw = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (raw && raw.token && raw.exp > Date.now()) return raw;
    } catch { /* bozuk kayıt */ }
    return null;
  }
  function saveSession(value) {
    session = value;
    try {
      if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
      else localStorage.removeItem(SESSION_KEY);
    } catch { /* depolama kapalı olabilir */ }
  }
  function loadFavMeta() {
    try { return JSON.parse(localStorage.getItem(FAV_META_KEY) || '{}') || {}; } catch { return {}; }
  }
  function saveFavMeta(meta) {
    try { localStorage.setItem(FAV_META_KEY, JSON.stringify(meta)); } catch { /* yoksay */ }
  }

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (session && path !== '/auth/google') headers.Authorization = `Bearer ${session.token}`;
    const response = await fetch(API + path, { ...options, headers });
    if (response.status === 401 && path !== '/auth/google') {
      saveSession(null);
      renderUi();
      throw new Error('Oturum süresi doldu. Google ile yeniden giriş yap.');
    }
    if (!response.ok) throw new Error('Bulut sunucusuna ulaşılamadı.');
    return response.json();
  }

  function localSnapshot() {
    const favorites = {};
    const meta = loadFavMeta();
    const now = Date.now();
    const songs = getSongs();
    for (const song of songs) {
      const key = songKey(song);
      let m = meta[key];
      if (!m) m = meta[key] = { fav: !!song.favorite, at: song.favorite ? now : 0 };
      else if (m.fav !== !!song.favorite) m = meta[key] = { fav: !!song.favorite, at: now };
      if (m.at > 0) favorites[key] = { name: song.name, fav: m.fav, at: m.at };
    }
    saveFavMeta(meta);

    const stats = {};
    const byId = new Map(songs.map((song) => [String(song.id), song]));
    for (const [id, entry] of Object.entries(getStats().tracks)) {
      const key = entry.key || (byId.has(id) ? songKey(byId.get(id)) : '');
      if (!key) continue;
      entry.key = key;
      if (!(entry.plays > 0 || entry.seconds > 0)) continue;
      stats[key] = { name: entry.name, plays: entry.plays, seconds: Math.round(entry.seconds) };
    }
    return { v: 1, favorites, stats };
  }

  async function applyToLibrary(merged) {
    applying = true;
    try {
      const meta = loadFavMeta();
      let favChanged = false;
      for (const song of getSongs()) {
        const key = songKey(song);
        const remote = merged.favorites[key];
        const local = meta[key];
        if (remote && remote.at > (local?.at || 0) && !!song.favorite !== !!remote.fav) {
          song.favorite = !!remote.fav;
          meta[key] = { fav: !!remote.fav, at: remote.at };
          try { await saveSong(song); favChanged = true; } catch { /* sonraki eşitlemede denenir */ }
        } else if (remote && !local) {
          meta[key] = { fav: !!remote.fav, at: remote.at };
        }
      }
      saveFavMeta(meta);

      let statsChanged = false;
      const stats = getStats();
      for (const song of getSongs()) {
        const key = songKey(song);
        const remote = merged.stats[key];
        if (!remote) continue;
        const id = String(song.id);
        const entry = stats.tracks[id] || { name: song.name, plays: 0, seconds: 0, key };
        if ((remote.plays || 0) > entry.plays || (remote.seconds || 0) > entry.seconds) {
          entry.plays = Math.max(entry.plays, remote.plays || 0);
          entry.seconds = Math.max(entry.seconds, remote.seconds || 0);
          entry.key = key;
          stats.tracks[id] = entry;
          statsChanged = true;
        }
      }
      if (statsChanged) persistStats();
      if (favChanged || statsChanged) refresh();
    } finally {
      applying = false;
    }
  }

  async function syncNow({ quiet = true } = {}) {
    if (!session) return;
    if (syncing) { rerun = true; return; }
    syncing = true;
    renderUi();
    try {
      const remote = await api('/sync');
      const remoteData = remote?.data || { favorites: {}, stats: {} };
      const merged = mergeData(remoteData, localSnapshot());
      setState(merged);
      await applyToLibrary(merged);
      const final = mergeData(merged, localSnapshot());
      setState(final);
      if (stable(final) !== stable(remoteData)) await api('/sync', { method: 'PUT', body: JSON.stringify({ data: final }) });
      try { localStorage.setItem(LAST_SYNC_KEY, String(Date.now())); } catch { /* yoksay */ }
      const favCount = Object.values(final.favorites || {}).filter((f) => f && f.fav).length;
      const statCount = Object.keys(final.stats || {}).length;
      if (!quiet) toast(`Yedek buluta gönderildi (${favCount} favori, ${statCount} dinleme kaydı).`);
    } catch (error) {
      if (!quiet) toast(error instanceof Error ? error.message : 'Bulut eşitleme başarısız.', true);
    } finally {
      syncing = false;
      renderUi();
      if (rerun) { rerun = false; void syncNow(); }
    }
  }

  function schedulePush() {
    if (!session || applying || timer) return;
    timer = window.setTimeout(() => { timer = 0; void syncNow(); }, PUSH_DELAY_MS);
  }

  function loadGoogleScript() {
    if (window.google?.accounts?.id) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-gsi]');
      if (existing) { existing.addEventListener('load', resolve); existing.addEventListener('error', reject); return; }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.dataset.gsi = '1';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function onCredential(response) {
    busy = true;
    renderUi();
    try {
      const result = await api('/auth/google', { method: 'POST', body: JSON.stringify({ credential: response.credential }) });
      saveSession({ token: result.token, email: result.email, exp: Date.now() + result.expiresIn * 1000 - 60000 });
      await syncNow({ quiet: false });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Giriş yapılamadı.', true);
    } finally {
      busy = false;
      renderUi();
    }
  }

  async function mountGoogleButton(holder) {
    if (!holder) return;
    try {
      await loadGoogleScript();
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onCredential, ux_mode: 'popup' });
      window.google.accounts.id.renderButton(holder, { theme: 'outline', size: 'medium', shape: 'pill', text: 'signin_with', locale: 'tr' });
    } catch {
      holder.textContent = 'Google girişi yüklenemedi.';
    }
  }

  async function signOut() {
    try { window.google?.accounts?.id?.disableAutoSelect(); } catch { /* yoksay */ }
    saveSession(null);
    consentGiven = false;
    renderUi();
    toast('Oturum kapatıldı. Buluttaki yedeğin korundu.');
  }

  async function deleteCloudData() {
    // 1. Adım: İlk onay sorusu
    const firstConfirm = window.confirm(
      '1. ONAY: Buluttaki tüm favori ve dinleme istatistiği yedeğin silinecek.\n\nDevam etmek istiyor musun?'
    );
    if (!firstConfirm) return;

    // 2. Adım: Hatalı kararın önüne geçmek için ikinci kesin onay sorusu
    const secondConfirm = window.confirm(
      'SON UYARI (2/2): Bu işlem geri alınamaz ve bulut yedeğin kalıcı olarak kaldırılır (cihazındaki ses dosyaları silinmez).\n\nBulut verini kalıcı olarak silmeyi onaylıyor musun?'
    );
    if (!secondConfirm) return;

    try {
      await api('/sync', { method: 'DELETE' });
      setState({ v: 1, favorites: {}, stats: {} });
      try { localStorage.removeItem(LAST_SYNC_KEY); } catch {}
      renderUi();
      toast('Bulut verin kalıcı olarak silindi.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Bulut verisi silinemedi.', true);
    }
  }

  async function downloadCloudBackup() {
    if (!session) return;
    try {
      const remote = await api('/sync');
      const data = remote?.data || { v: 1, favorites: {}, stats: {} };
      const payload = { app: 'sescebi-bulut-yedek', created: new Date().toISOString(), email: session.email, data };
      const day = new Date().toISOString().slice(0, 10);
      const file = new File([JSON.stringify(payload, null, 1)], `ses-cebi-bulut-yedek-${day}.json`, { type: 'application/json' });
      if (typeof saveFile === 'function') await saveFile(file);
      else {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url; a.download = file.name;
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      const favCount = Object.values(data.favorites || {}).filter((f) => f && f.fav).length;
      toast(`Bulut yedeği indirildi (${favCount} favori, ${Object.keys(data.stats || {}).length} dinleme kaydı).`);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Bulut yedeği indirilemedi.', true);
    }
  }

  function ensureBox() {
    if (box && document.body.contains(box)) return box;
    const anchor = document.querySelector('.library-subtools');
    if (!anchor) return null;
    box = document.createElement('div');
    box.className = 'cloud-box';
    anchor.insertAdjacentElement('afterend', box);
    return box;
  }

  function renderUi() {
    const el = ensureBox();
    if (!el) return;
    el.textContent = '';
    const note = document.createElement('small');
    note.textContent = 'Not: "Yedeği buluta gönder" favori ve dinleme verilerini Google hesabına kaydeder; ses dosyaları ise "ZIP yedek al" ile cihazında tutulur. "Bulut yedeğini indir" buluttaki kaydı JSON dosyası olarak indirir.';

    if (!session) {
      const p = document.createElement('p');
      p.textContent = 'Gmail hesabınla giriş yaparak favorilerini ve dinleme istatistiklerini buluta yedekleyebilirsin.';
      const label = document.createElement('label');
      label.className = 'consent';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = consentGiven;
      check.addEventListener('change', () => { consentGiven = check.checked; renderUi(); });
      const text = document.createElement('span');
      text.textContent = 'Ayarlar → Gizlilik & Koşullar içindeki Gizlilik Politikası ve KVKK Aydınlatma Metni’ni okudum; e-posta adresimin ve favori/dinleme verilerimin Google ve Cloudflare altyapılarında (yurt dışı) işlenmesine açık rıza veriyorum.';
      label.append(check, text);
      el.append(p, label);
      if (consentGiven) {
        const holder = document.createElement('div');
        el.append(holder);
        if (!busy) void mountGoogleButton(holder);
      }
      el.append(note);
      return;
    }

    const last = Number(localStorage.getItem(LAST_SYNC_KEY)) || 0;
    const p = document.createElement('p');
    p.innerHTML = `<strong>Bağlı hesap:</strong> ${session.email}${last ? ` · son eşitleme ${new Date(last).toLocaleTimeString('tr', { hour: '2-digit', minute: '2-digit' })}` : ''}`;
    const actions = document.createElement('div');
    actions.className = 'cloud-actions';
    const make = (label, cls, handler) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = cls;
      button.textContent = label;
      button.addEventListener('click', handler);
      return button;
    };
    actions.append(
      make(syncing ? 'Gönderiliyor…' : '☁ Yedeği buluta gönder', 'primary-button cloud-push-btn', () => void syncNow({ quiet: false })),
      make('⬇ Bulut yedeğini indir', 'ghost-button', () => void downloadCloudBackup()),
      make('Çıkış yap', 'ghost-button', () => void signOut()),
      make('Bulut verimi sil', 'ghost-button cloud-danger-btn', () => void deleteCloudData()),
    );
    const hint = document.createElement('small');
    hint.textContent = '“Yedeği buluta gönder” verini Cloudflare’e yazar. “Bulut yedeğini indir” ise buluttaki veriyi JSON dosyası olarak cihazına kaydeder; bilgisayarda açılan pencere, dosyayı nereye kaydedeceğini sorar.';
    el.append(p, actions, hint, note);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && session && timer) {
      window.clearTimeout(timer);
      timer = 0;
      void syncNow();
    }
  });

  renderUi();
  if (session) void syncNow();

  async function importCloudFile(file) {
    try {
      const parsed = JSON.parse(await file.text());
      const data = parsed?.app === 'sescebi-bulut-yedek' ? parsed.data : null;
      if (!data || typeof data !== 'object') throw new Error('Bu dosya bir Ses Cebi bulut yedeği değil.');
      const merged = mergeData(data, localSnapshot());
      setState(merged);
      await applyToLibrary(merged);
      if (session) schedulePush();
      const favCount = Object.values(merged.favorites || {}).filter((f) => f && f.fav).length;
      const present = new Set(getSongs().map((song) => songKey(song)));
      const waiting = new Set([...Object.keys(merged.favorites || {}), ...Object.keys(merged.stats || {})].filter((key) => !present.has(key))).size;
      toast(`Bulut yedeği yüklendi (${favCount} favori, ${Object.keys(merged.stats || {}).length} dinleme kaydı).${waiting ? ` ${waiting} kaydın sesi arşivde yok; bu cihazda bekletiliyor, ses eklenince otomatik eşleşir.` : ''}`);
    } catch (error) {
      toast(error instanceof SyntaxError ? 'Dosya okunamadı; geçerli bir JSON yedeği seç.' : (error instanceof Error ? error.message : 'Bulut yedeği yüklenemedi.'), true);
    }
  }

  return {
    importCloudFile,
    notifyChange() { schedulePush(); },
    favoriteChanged(song) {
      const meta = loadFavMeta();
      meta[songKey(song)] = { fav: !!song.favorite, at: Date.now() };
      saveFavMeta(meta);
      schedulePush();
    },
    libraryRendered() {
      const count = getSongs().length;
      if (count === lastCount) return;
      lastCount = count;
      if (!applying) void applyToLibrary(state).then(() => schedulePush());
    },
  };
}
