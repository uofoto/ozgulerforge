import { initCloudSync, songKey } from './cloud-sync.js';
const DB_NAME = 'sescebi-db';
const STORE_NAME = 'songs';
const MAX_SIZE = 100 * 1024 * 1024;
const audio = new Audio();
let songs = [];
let activeSong = null;
let activeObjectUrl = '';
let selectedFile = null;
let activeTab = 'file';
let toastTimer = 0;
let favoritesOnly = false;
let searchQuery = '';
let sortMode = 'newest';
let studioSelectionMode = false;
const LISTENING_STATS_KEY = 'sescebi-listening-stats-v1';
let listeningStats = readListeningStats();
let listeningSession = null;
let cloudSync = null;
let sleepTimerId = 0;
// Klasörler (etiketler): şiir / müzik / hayata dair. Kayıtta song.category olarak saklanır; yoksa klasörsüzdür.
const FOLDERS_KEY = 'sescebi-folders';
const CATEGORIES = [
    { id: 'siir', label: 'Şiir', dir: 'siir' },
    { id: 'muzik', label: 'Müzik', dir: 'muzik' },
    { id: 'hayat', label: 'Hayata dair', dir: 'hayata-dair' },
];
// v36: klasörler uygulama içinden eklenip düzenlenebilir; liste bu cihazda saklanır.
function cleanFolder(item) {
    if (!item || typeof item.id !== 'string' || typeof item.label !== 'string')
        return null;
    const label = item.label.trim().slice(0, 24);
    const id = item.id.slice(0, 40);
    if (!label || !id || id === 'all' || id === 'none')
        return null;
    return { id, label, dir: typeof item.dir === 'string' && item.dir ? item.dir.slice(0, 40) : id };
}
try {
    const stored = JSON.parse(localStorage.getItem(FOLDERS_KEY) || 'null');
    if (Array.isArray(stored))
        CATEGORIES.splice(0, CATEGORIES.length, ...stored.map(cleanFolder).filter(Boolean));
}
catch { /* kayıtlı klasör yoksa varsayılanlar */ }
function saveFolders() {
    try {
        localStorage.setItem(FOLDERS_KEY, JSON.stringify(CATEGORIES));
    }
    catch { /* depolama kapalıysa bu oturumda geçerli */ }
}
let categoryFilter = 'all'; // 'all' | 'none' | kategori id
let addCategory = '';       // yeni eklenen seslerin gideceği klasör ('' = klasörsüz)
let lastVisibleSongs = [];  // arşivde şu an listelenenler (arama/favori/klasör/sıralama sonrası)
let queueIds = null;        // null: tüm arşiv (eski davranış); dizi: klasör/liste sırası
let queueName = '';
let listenAll = false;      // "Tümünü dinle" oturumu
let categoryTarget = null;
const app = document.querySelector('#app');
if (!app)
    throw new Error('Uygulama kökü bulunamadı.');
const icons = {
    cassette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8" cy="12" r="2.1"/><circle cx="16" cy="12" r="2.1"/><path d="M6 16.5h12M7 5V3.5M17 5V3.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M8 8l4-4 4 4"/><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6a1.2 1.2 0 0 0 1.8 1l9.7-6.8a1.2 1.2 0 0 0 0-2L9.8 4.2A1.2 1.2 0 0 0 8 5.2Z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5.5A1.5 1.5 0 0 1 8.5 4h1A1.5 1.5 0 0 1 11 5.5v13A1.5 1.5 0 0 1 9.5 20h-1A1.5 1.5 0 0 1 7 18.5v-13ZM13 5.5A1.5 1.5 0 0 1 14.5 4h1A1.5 1.5 0 0 1 17 5.5v13a1.5 1.5 0 0 1-1.5 1h-1a1.5 1.5 0 0 1-1.5-1v-13Z"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M8 11l4 4 4-4M5 20h14"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v5M14 11v5M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    rewind: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 8 4 12l5 4"/><path d="M4 12h9a4 4 0 1 1-4 4"/></svg>',
    forward: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 8 5 4-5 4"/><path d="M20 12h-9a4 4 0 1 0 4 4"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13.5 14 9.5M8.2 16.8l-1.1 1.1a3.7 3.7 0 0 1-5.2-5.2l3.7-3.7a3.7 3.7 0 0 1 5.2 0M15.8 7.2l1.1-1.1a3.7 3.7 0 0 1 5.2 5.2l-3.7 3.7a3.7 3.7 0 0 1-5.2 0"/></svg>',
    scissors: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    studio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 13.5c2.2 0 2.2-5 4.4-5s2.2 7 4.4 7 2.2-9 4.4-9S19.4 13.5 21 13.5"/><path d="M4 18.5h16"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z"/></svg>',
    heartFill: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>',
};
app.innerHTML = `
  <div class="app-shell">
    <nav class="main-nav" aria-label="Ana gezinme">
      <button class="nav-item active" type="button" data-screen="library">${icons.list}<span>Sesler</span><span class="nav-count" id="nav-count">0</span></button>
      <button class="nav-item" type="button" data-screen="home">${icons.plus}<span>Ekle</span></button>
      <button class="nav-item" type="button" data-screen="studio">${icons.studio}<span>Stüdyo</span></button>
    </nav>

    <header class="topbar">
      <h1 class="brand-name" id="topbar-title">Ses arşivi</h1>
      <button class="icon-button" type="button" id="open-profile-sheet" aria-label="Ayarlar ve yedek" title="Ayarlar ve yedek">${icons.settings}</button>
    </header>

    <main>
      <section class="screen-view active" id="screen-library">
        <div class="studio-picker-banner" id="studio-picker-banner" hidden role="status">
          <div><strong>Stüdyo için bir kayıt seç</strong><span>Düzenlemek istediğin kayda dokun.</span></div>
          <button class="ghost-button" id="studio-picker-cancel" type="button">Vazgeç</button>
        </div>
        <div class="filter-bar">
          <label class="search-wrap">
            ${icons.search}
            <input class="text-input library-search" id="library-search" type="search" placeholder="Ara" aria-label="Seslerde ara" />
          </label>
          <button class="chip" id="favorites-filter" type="button" aria-pressed="false" aria-label="Yalnızca favoriler" title="Yalnızca favoriler">${icons.heart}</button>
          <select class="library-sort" id="library-sort" aria-label="Sırala">
            <option value="newest">Yeni</option>
            <option value="oldest">Eski</option>
            <option value="az">A–Z</option>
            <option value="duration">Süre</option>
          </select>
        </div>
        <div class="folder-bar" id="folder-bar" role="group" aria-label="Klasörler" hidden></div>
        <div class="library-head">
          <p class="library-count" id="library-count">0 kayıt</p>
          <button class="ghost-button listen-all" id="listen-all" type="button" hidden>${icons.play}<span>Tümünü dinle</span></button>
        </div>
        <div class="empty-state" id="empty-state">
          <h3>Arşivin henüz boş</h3>
          <p>İlk ses kaydını ekleyerek başla.</p>
          <button type="button" class="primary-button empty-add" data-screen="home">${icons.plus}<span>Kayıt ekle</span></button>
        </div>
        <div class="song-list" id="song-list"></div>
      </section>

      <section class="screen-view" id="screen-home">
        <div class="clean-page-head">
          <h1>Ses ekle</h1>
          <p>Dosya seç, bağlantı yapıştır veya izinli bir X videosundan sesi al.</p>
        </div>
        <section class="card add-card" aria-labelledby="add-title">
          <h2 class="sr-only" id="add-title">Arşive yeni ses ekle</h2>
          <div class="tabs" role="tablist" aria-label="Ses ekleme yöntemi">
            <button class="tab active" type="button" role="tab" aria-selected="true" data-tab="file">Dosya</button>
            <button class="tab" type="button" role="tab" aria-selected="false" data-tab="url">Bağlantı</button>
            <button class="tab" type="button" role="tab" aria-selected="false" data-tab="x-video">X videosu</button>
          </div>
          <div id="file-panel" role="tabpanel">
            <label class="file-drop" for="file-input">
              <span class="upload-icon">${icons.upload}</span>
              <strong>Ses veya video dosyası seç</strong>
              <span>MP3, M4A, WAV, OGG, MP4 · en fazla 100 MB</span>
              <input id="file-input" type="file" accept="audio/*,video/*,.mp3,.m4a,.wav,.ogg,.aac,.flac,.mp4,.m4v,.mov,.webm,.mkv" />
            </label>
            <p class="file-name" id="file-name" aria-live="polite">Henüz dosya seçilmedi</p>
          </div>
          <div id="url-panel" class="url-panel" role="tabpanel" hidden>
            <label class="sr-only" for="url-input">Doğrudan ses dosyası bağlantısı</label>
            <div class="input-clear-wrap"><input class="text-input" id="url-input" type="url" inputmode="url" placeholder="https://site.com/ses.mp3" autocomplete="off" /><button class="input-clear" id="url-clear" type="button" aria-label="Bağlantıyı temizle" title="Bağlantıyı temizle" hidden>${icons.close}</button></div>
            <p class="url-hint">Herkese açık, doğrudan ses dosyası bağlantıları desteklenir.</p>
          </div>
          <div id="x-video-panel" class="x-video-panel" role="tabpanel" hidden>
            <div class="x-video-form">
              <label class="sr-only" for="x-video-url">X gönderi bağlantısı</label>
              <div class="input-clear-wrap"><input class="text-input" id="x-video-url" type="url" inputmode="url" placeholder="https://x.com/kullanici/status/123…" autocomplete="off" /><button class="input-clear" id="x-video-clear" type="button" aria-label="Bağlantıyı temizle" title="Bağlantıyı temizle" hidden>${icons.close}</button></div>
              <button class="ghost-button" id="x-video-find" type="button">Bul</button>
            </div>
            <p class="x-video-status" id="x-video-status" role="status" aria-live="polite"></p>
            <div class="x-video-results" id="x-video-results"></div>
          </div>
          <div class="folder-pick" role="group" aria-labelledby="folder-pick-label">
            <span class="folder-pick-label" id="folder-pick-label">Klasör</span>
            <div class="folder-chips" id="add-folder"></div>
          </div>
          <label class="consent"><input id="consent" type="checkbox" /><span>Bu sesi kullanma ve indirme hakkına sahibim; sorumluluğun bana ait olduğunu kabul ediyorum.</span></label>
          <button class="primary-button" id="add-button" type="button" disabled>${icons.plus}<span>Arşive ekle</span></button>
          <div class="progress-wrap" id="progress-wrap" aria-live="polite">
            <div class="progress-line"><span id="progress-label">Hazırlanıyor…</span><strong id="progress-value">0%</strong></div>
            <progress id="progress" max="100" value="0">0%</progress>
          </div>
        </section>
        <section class="card recent-card" id="recent-wrapper">
          <div class="aside-heading">
            <h2>Son eklenenler</h2>
            <button class="subtle-action-link" type="button" data-screen="library">Tüm arşiv</button>
          </div>
          <div id="dashboard-recent" class="recent-list"></div>
          <div id="dashboard-empty" class="recent-empty"><span>Henüz kayıt eklenmedi.</span></div>
        </section>
      </section>

      <section class="screen-view" id="screen-studio">
        <div class="clean-page-head">
          <h1>Stüdyo</h1>
          <p>Bir kaydı seç; dalga formunda kes, fade ve bas/tiz uygula.</p>
        </div>
        <section class="studio-workbench">
          <div class="studio-copy">
            <h2>Kesmek için bir kayıt seç</h2>
            <p>Dalga formunu yakınlaştırıp saniye hassasiyetiyle kes, sonucu WAV olarak arşive kaydet.</p>
            <button class="primary-button" id="studio-open-library" type="button">${icons.scissors}<span>Arşivden kayıt seç</span></button>
          </div>
        </section>
      </section>
    </main>

    <div class="player" id="player" aria-live="polite">
      <div class="player-inner">
        <div class="player-top">
          <div class="player-title"><strong id="player-title">—</strong><span id="player-subtitle">Çalmaya hazır</span></div>
          <div class="player-equalizer" id="player-equalizer" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        </div>
        <div class="player-controls">
          <button class="player-button small" id="back-button" type="button" aria-label="10 saniye geri">${icons.rewind}</button>
          <button class="player-button" id="play-button" type="button" aria-label="Oynat">${icons.play}</button>
          <button class="player-button small" id="forward-button" type="button" aria-label="10 saniye ileri">${icons.forward}</button>
          <span class="time" id="time">00:00 / 00:00</span>
          <input class="seek" id="seek" type="range" min="0" max="100" value="0" aria-label="Ses ilerlemesi" />
        </div>
        <div class="player-volume" id="player-volume">
          <button class="player-button small" id="mute-button" type="button" aria-label="Sesi kapat / aç"><svg id="mute-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z"/><path id="vol-wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg></button>
          <input class="volume-slider" id="volume-slider" type="range" min="0" max="100" step="1" value="100" aria-label="Ses seviyesi" />
          <output id="volume-value">100%</output>
        </div>
        <details class="player-more">
          <summary>Seçenekler</summary>
          <div class="player-extra">
            <button class="chip" id="prev-button" type="button">Önceki</button>
            <button class="chip" id="next-button" type="button">Sonraki</button>
            <button class="chip" id="mode-button" type="button">Sırayla</button>
            <label class="speed-control">Hız <select id="playback-speed" aria-label="Oynatma hızı"><option value="0.75">0,75×</option><option value="1" selected>1×</option><option value="1.25">1,25×</option><option value="1.5">1,5×</option><option value="2">2×</option></select></label>
            <button class="chip" id="sleep-button" type="button">Uyku</button>
          </div>
        </details>
      </div>
    </div>
  </div>

  <!-- ======================== ÇEKMECE 1: YEDEK, ÖZET & UYGULAMA ======================== -->
  <div class="overlay" id="profile-overlay" hidden>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="profile-sheet-title">
      <div class="sheet-head">
        <h2 id="profile-sheet-title">Ayarlar ve yedek</h2>
        <button class="icon-button" id="profile-close" type="button" aria-label="Kapat">${icons.close}</button>
      </div>

      <section class="metric-row" aria-label="Arşiv özeti">
        <article class="metric-card"><span class="metric-label">KAYIT</span><strong id="stat-count">0</strong></article>
        <article class="metric-card"><span class="metric-label">FAVORİ</span><strong id="stat-favorites">0</strong></article>
        <article class="metric-card"><span class="metric-label">ALAN</span><strong id="stat-storage">0 B</strong></article>
      </section>

      <section class="listening-stats" id="listening-stats-panel" aria-labelledby="listening-stats-title">
        <div class="stats-heading">
          <h3 id="listening-stats-title">Dinleme günlüğü</h3>
          <button class="stats-toggle" id="stats-toggle" type="button" aria-expanded="false" aria-controls="listening-stats-content"><span>Göster</span><span class="stats-toggle-icon" aria-hidden="true">⌄</span></button>
        </div>
        <div class="listening-stats-grid" id="listening-stats-content">
          <article class="listen-stat-card"><span class="listen-stat-label">ÇALMA</span><strong id="stat-play-count">0</strong></article>
          <article class="listen-stat-card"><span class="listen-stat-label">SÜRE</span><strong id="stat-listen-time">0 sn</strong></article>
          <article class="listen-stat-card"><span class="listen-stat-label">FARKLI SES</span><strong id="stat-unique-tracks">0</strong></article>
          <article class="listen-stat-card"><span class="listen-stat-label">EN ÇOK</span><button class="top-track-link" id="stat-top-track" type="button" disabled>Henüz yok</button><small id="stat-top-play-count"></small></article>
        </div>
      </section>

      <div class="sheet-block">
        <h3>ZIP Yedekleme &amp; Bulut Eşitleme</h3>
        <p class="sheet-sub">Kayıtların yalnızca bu cihazda tutulur. Dilediğinde tek dosya halinde yedek alabilirsin. “Yedeği yükle” hem ZIP yedeğini (sesler) hem de bulut yedeği JSON dosyasını (favoriler ve dinleme verisi) kabul eder.</p>
        <div class="backup-row">
          <button class="primary-button" id="backup-button" type="button">${icons.download}<span>ZIP yedek al</span></button>
          <button class="ghost-button" id="restore-button" type="button">${icons.upload}<span>Yedeği yükle</span></button>
          <input id="restore-input" type="file" accept=".zip,.json,application/zip,application/json" aria-label="Yedek dosyası seç" />
        </div>
        <div class="library-subtools" aria-label="Bulut yedekleme"></div>
      </div>

      <div class="sheet-block install-sheet-box">
        <div>
          <strong>Ana Ekrana Yükle (PWA)</strong>
          <small id="app-status"></small>
        </div>
        <div class="app-card-actions">
          <button class="primary-button install-button" id="install-button" type="button">${icons.download}<span>Yükle</span></button>
          <button class="ghost-button" id="update-button" type="button">Güncelle</button>
          <button class="ghost-button" id="diag-button" type="button">Durum</button>
        </div>
        <pre class="diag-output" id="diag-output" hidden></pre>
      </div>

      <div class="sheet-block">
        <h3>Görünüm ve bilgi</h3>
        <div class="app-card-actions">
          <button class="ghost-button" id="theme-toggle" type="button">Açık / koyu temayı değiştir</button>
          <button class="ghost-button" id="open-guide-sheet" type="button">Kullanım kılavuzu</button>
          <button class="ghost-button" id="open-legal-sheet" type="button">Gizlilik &amp; Koşullar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ======================== ÇEKMECE: KULLANIM KILAVUZU ======================== -->
  <div class="overlay" id="guide-overlay" hidden>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="guide-sheet-title">
      <div class="sheet-head">
        <h2 id="guide-sheet-title">Kullanım Kılavuzu</h2>
        <button class="icon-button" id="guide-close" type="button" aria-label="Kapat">${icons.close}</button>
      </div>
      <div class="legal-sheet-body">
        <p class="legal-date">Ses Cebi, izinli seslerini telefonunda saklayıp çevrimdışı dinlemen için yapıldı. Aşağıdaki başlıklara dokunarak aç.</p>

        <details class="legal-section" open>
          <summary>1. Başlarken</summary>
          <p>Altta üç sekme var: <strong>Sesler</strong> (kayıtların), <strong>Ekle</strong> (yeni ses) ve <strong>Stüdyo</strong> (kesme). Sağ üstteki dişli simgesi Ayarlar ve yedek bölümünü açar.</p>
          <p>Hesap açman gerekmez. Sesler yalnızca bu telefonda, tarayıcının içinde saklanır; internet olmadan da dinleyebilirsin.</p>
        </details>

        <details class="legal-section">
          <summary>2. Ses ekleme</summary>
          <h3>Dosya</h3>
          <p><strong>Ekle → Dosya</strong>: ses ya da video dosyası seç (MP3, M4A, WAV, OGG, MP4… en fazla 100 MB). Videoysa sesi ayrılıp eklenir.</p>
          <h3>Bağlantı</h3>
          <p><strong>Ekle → Bağlantı</strong>: herkese açık, doğrudan ses dosyası adresini yapıştır. Sayfa bağlantıları (ör. Instagram) çalışmaz. Alandaki × düğmesi eski bağlantıyı tek dokunuşla siler.</p>
          <h3>X videosu</h3>
          <p><strong>Ekle → X videosu</strong>: gönderi bağlantısını yapıştırıp <em>Bul</em>'a bas. Kaliteyi seçip videoyu indirebilir ya da yalnızca sesini arşive ekleyebilirsin. Gizli veya silinmiş gönderiler desteklenmez.</p>
          <h3>Klasör ve onay</h3>
          <p>İstersen sesi bir klasöre koy (başlangıçta <strong>Şiir, Müzik, Hayata dair</strong> var). Kendi klasörünü eklemek, adını değiştirmek veya silmek için <strong>＋ Klasör</strong> düğmesine dokun; klasör silinince sesler silinmez, klasörsüz kalır. Eklemeden önce, sesi kullanma hakkına sahip olduğunu belirten kutuyu işaretlemen gerekir. Yalnızca sahibi olduğun ya da kullanma izni bulunan içerikleri ekle.</p>
        </details>

        <details class="legal-section">
          <summary>3. Dinleme</summary>
          <p>Listede bir sese dokunursan <strong>baştan</strong> çalar. Alttaki oynatıcıda 10 sn geri/ileri ve ilerleme çubuğu var. <strong>Seçenekler</strong> altında şunlar bulunur: önceki / sonraki, çalma düzeni (tek seferlik, sırayla, tekrar, karıştır), hız ve uyku zamanlayıcısı.</p>
          <p><strong>Tümünü dinle</strong> ekrandaki listeyi (klasör, arama, favori ve sıralamaya göre) baştan sona çalar. Telefon kilitliyken de kilit ekranından önceki/sonraki yapabilirsin; bu, telefon ve tarayıcıya bağlı çalışır.</p>
          <p>Kalp simgesi favoriye ekler; ⋯ menüsünden <strong>yeniden adlandırabilir, klasöre taşıyabilir, kesebilir, paylaşabilir, indirebilir veya silebilirsin</strong>. Üstteki arama ve sıralama ile listeyi daraltabilirsin.</p>
        </details>

        <details class="legal-section">
          <summary>4. Stüdyo: sesi kesme</summary>
          <p>⋯ → <strong>Sesi kes</strong> (ya da Stüdyo sekmesinden bir kayıt seç). Dalga biçiminde başlangıç ve bitişi kaydır, yakınlaştırmayla saniye altı hassasiyetle ayarla, istersen fade giriş/çıkış ve bas/tiz uygula. <em>Seçimi dinle</em> ile dene, sonra kaydet. Sonuç WAV olarak arşive girer. “Orijinal ses arşivde kalsın” kutusu, aslının silinip silinmeyeceğini belirler.</p>
        </details>

        <details class="legal-section">
          <summary>5. Telefona indirme ve paylaşma</summary>
          <p>⋯ → <strong>İndir</strong> sesi telefonun indirilenler klasörüne kaydeder; kayıt yeri uygulamada gösterilir. Android'de ses müzik çalarında görünmeyebilir, bu durumda dosya yöneticisinden aç. iPhone'da dosya <strong>Dosyalar → İndirilenler</strong> içindedir. <strong>Paylaş</strong> ile e-posta, Drive gibi uygulamalara gönderebilirsin.</p>
        </details>

        <details class="legal-section">
          <summary>6. Yedekleme (önemli)</summary>
          <p>Sesler tarayıcı depolamasında durduğu için silinebilir (bkz. 7). Bu yüzden arada bir <strong>Ayarlar → ZIP yedek al</strong> yap ve ZIP dosyasını Drive'a veya bilgisayara kopyala. Klasörlerin ve favorilerin de yedeğe girer. Silinirse <strong>Yedeği yükle</strong> ile geri getirirsin; eski yedekler de açılır.</p>
          <h3>Bulut yedeği (isteğe bağlı)</h3>
          <p>Google ile giriş yaparsan favorilerin ve dinleme istatistiklerin buluta eşitlenir. <strong>Ses dosyaları buluta gitmez.</strong> Ayarlar'daki “Bulut yedeğini indir” bu veriyi dosya olarak indirir, “Bulut verimi sil” kalıcı olarak siler. İndirdiğin JSON dosyasını geri yüklemek için <strong>Yedeği yükle</strong>'ye bas ve o dosyayı seç. Önce ZIP yedeğini yükleyip sesleri geri getir, çünkü favoriler yalnızca arşivdeki seslerle eşleşir.</p>
        </details>

        <details class="legal-section">
          <summary>7. Seslerim ne zaman silinir?</summary>
          <p>Aşağıdakilerden biri, Ses Cebi'ndeki tüm sesleri silebilir:</p>
          <ul>
            <li>Tarayıcıda <strong>çerezleri ve site verilerini</strong> silmek (Chrome: Geçmişi sil → Çerezler ve site verileri).</li>
            <li>Tarayıcının site ayarlarında bu sitenin <strong>depolamasını temizlemek</strong>.</li>
            <li>Android'de Ayarlar → Uygulamalar → tarayıcın → Depolama → <strong>Verileri temizle</strong>.</li>
            <li>Ana ekrana yüklenmiş uygulamayı kaldırırken “verileri de sil”i seçmek. iPhone'da ana ekran simgesini silmek verileri de siler.</li>
            <li>Telefon temizleyici veya hızlandırıcı uygulamalarının tarayıcı verisi temizliği.</li>
            <li>Tarayıcıyı kaldırmak, sıfırlamak veya telefonu fabrika ayarlarına döndürmek.</li>
            <li><strong>Gizli sekme</strong> kullanmak (pencere kapanınca kayıtlar gider).</li>
            <li>iPhone Safari'de uygulamayı ana ekrana yüklemeden yaklaşık bir hafta hiç açmamak.</li>
            <li>Telefon depolaması çok dolarsa tarayıcının site verisini kendiliğinden silmesi.</li>
          </ul>
          <p><strong>Silmez:</strong> “Önbelleği temizle” (genelde), İndirilenler klasöründeki kopyaların silinmesi ve uygulama güncellemesi. Yine de bazı temizleyiciler önbellekle birlikte site verisini de siler; emin değilsen önce ZIP yedek al.</p>
        </details>

        <details class="legal-section">
          <summary>8. Ana ekrana yükleme ve güncelleme</summary>
          <p><strong>Ayarlar → Yükle</strong> (veya tarayıcı menüsünden “Ana ekrana ekle”) ile Ses Cebi uygulama gibi açılır ve çevrimdışı çalışır. Güncellemeler kendiliğinden gelir; gelmediyse <strong>Güncelle</strong>'ye bas, sorun olursa <strong>Durum</strong> ekranındaki bilgiyi bize gönder.</p>
        </details>

        <details class="legal-section">
          <summary>9. Sık sorulanlar</summary>
          <h3>Ses çalmıyor veya “oynatılamadı” diyor.</h3>
          <p>Dosya bozuk ya da tarayıcının desteklemediği bir biçimde olabilir. Aynı sesi MP3 veya M4A olarak yeniden ekle.</p>
          <h3>X videosu bulunamadı.</h3>
          <p>Gönderi silinmiş, gizli ya da videosuz olabilir. Bağlantının x.com veya twitter.com gönderisi olduğundan emin ol.</p>
          <h3>“Depolama dolu” uyarısı alıyorum.</h3>
          <p>Telefonda yer aç ya da yedek aldıktan sonra kullanmadığın sesleri sil.</p>
          <h3>Sorunum çözülmedi.</h3>
          <p><a href="mailto:iletisim@ozgulerforge.com.tr">iletisim@ozgulerforge.com.tr</a> adresine yazabilirsin. Hukuki konular için “Gizlilik &amp; Koşullar” bölümüne bak.</p>
        </details>
      </div>
    </div>
  </div>

  <!-- ======================== ÇEKMECE 2: YASAL & GİZLİLİK BİLGİLERİ ======================== -->
  <div class="overlay" id="legal-overlay" hidden>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="legal-sheet-title">
      <div class="sheet-head">
        <h2 id="legal-sheet-title">Gizlilik &amp; Kullanım Koşulları</h2>
        <button class="icon-button" id="legal-close" type="button" aria-label="Kapat">${icons.close}</button>
      </div>
      <div class="legal-sheet-body">
        <p class="legal-date">Son güncelleme: 25 Kasım 2026 · Ses Cebi, ozguler forge (ozgulerforge.com.tr) tarafından ücretsiz sunulur.</p>

        <details class="legal-section" open>
          <summary>Kullanım Koşulları</summary>
          <h3>1. Kapsam ve kabul</h3>
          <p>Bu koşullar, ozguler forge (“İşletmeci”) tarafından sunulan Ses Cebi uygulamasının (“Uygulama”) kullanımını düzenler. Uygulamayı kullanan herkes bu koşulları, Gizlilik Politikası’nı ve KVKK Aydınlatma Metni’ni okuduğunu ve kabul ettiğini beyan eder. Kabul etmiyorsanız Uygulamayı kullanmayınız.</p>
          <h3>2. Hizmetin niteliği</h3>
          <p>Uygulama; kullanıcının kendi cihazında ses dosyalarını saklamasını, dinlemesini, kesmesini ve yedeklemesini sağlayan, ücretsiz ve kişisel kullanıma yönelik bir araçtır. İşletmeci hiçbir ses veya video içeriği sağlamaz, barındırmaz, yayınlamaz ve içerikleri denetlemez. Eklenen içerikler yalnızca kullanıcının cihazında bulunur.</p>
          <h3>3. Kullanıcının yükümlülükleri</h3>
          <p>Kullanıcı; (a) yalnızca sahibi olduğu veya kullanma, çoğaltma ve indirme izni bulunan içerikleri eklemeyi, (b) 5846 sayılı Fikir ve Sanat Eserleri Kanunu başta olmak üzere tüm mevzuata ve üçüncü taraf platformların (ör. X) kullanım şartlarına uymayı, (c) teknik koruma önlemlerini aşmamayı, (d) içerikleri izinsiz yayımlamamayı, paylaşmamayı veya ticari amaçla kullanmamayı, (e) hukuka aykırı, hakaret, nefret veya başkalarının kişilik ve fikrî haklarını ihlal eden içerikleri kullanmamayı kabul eder. Ekleme sırasında işaretlenen “kullanma ve indirme hakkına sahibim” kutusu bu yönde verilmiş bir beyandır.</p>
          <h3>4. Fikrî mülkiyet</h3>
          <p>Uygulamanın yazılımı, tasarımı, adı ve logosu İşletmeci’ye aittir. Kullanıcının eklediği içeriklerin hakları kullanıcıya veya ilgili hak sahibine aittir; İşletmeci bu içerikler üzerinde hiçbir hak talep etmez.</p>
          <h3>5. Hizmette değişiklik</h3>
          <p>İşletmeci, Uygulamayı veya özelliklerini önceden bildirmeksizin değiştirebilir, kısıtlayabilir ya da sonlandırabilir. Hizmet ücretsiz sunulduğundan kesintisiz veya hatasız çalışacağı taahhüt edilmez.</p>
          <h3>6. Sorumluluk</h3>
          <p>İşletmeci’nin sorumluluğuna ilişkin hükümler “Sorumluluk Reddi” bölümünde düzenlenmiştir ve bu koşulların ayrılmaz parçasıdır.</p>
          <h3>7. Uygulanacak hukuk ve uyuşmazlık</h3>
          <p>Bu koşullara Türkiye Cumhuriyeti hukuku uygulanır. Tüketici işlemlerinde 6502 sayılı Tüketicinin Korunması Hakkında Kanun’daki yetkili tüketici hakem heyetleri ve mahkemeler saklıdır; diğer uyuşmazlıklarda İşletmeci’nin yerleşim yeri mahkemeleri ve icra daireleri yetkilidir.</p>
          <h3>8. Değişiklikler ve yürürlük</h3>
          <p>İşletmeci bu metinleri güncelleyebilir. Güncel metin Uygulama içinde yayımlandığı tarihten itibaren geçerlidir; Uygulamayı kullanmaya devam eden kullanıcı güncel metni kabul etmiş sayılır.</p>
        </details>

        <details class="legal-section">
          <summary>Gizlilik Politikası</summary>
          <h3>Kısaca</h3>
          <p>Hesap açmak zorunlu değildir. Ses dosyalarınız sunucuya gönderilmez; yalnızca cihazınızın tarayıcı belleğinde saklanır. İşletmeci reklam, izleme veya analitik aracı kullanmaz.</p>
          <h3>Cihazınızda saklananlar</h3>
          <p>Ses dosyaları ve bilgileri (ad, süre, klasör, favori) IndexedDB’de; tercihler, dinleme istatistikleri ve oturum bilgisi localStorage’da; çevrimdışı çalışma dosyaları Service Worker önbelleğinde tutulur. Bu veriler İşletmeci’ye ulaşmaz ve İşletmeci tarafından işlenmez. Tarayıcı verilerini silerseniz kaybolurlar; bu nedenle düzenli “ZIP yedek al” yapmanız önerilir.</p>
          <h3>Buluta gidenler (isteğe bağlı)</h3>
          <p>Yalnızca “Google ile giriş” yapıp eşitleme kullanırsanız şu veriler Cloudflare Workers/KV altyapısında saklanır: Google hesabınızın e-posta adresi, favori işaretlediğiniz seslerin adları, dinleme sayıları ve süreleri. Ses dosyaları buluta gönderilmez. Verilerinizi “Bulut yedeğini indir” ile alabilir, “Bulut verimi sil” ile kalıcı olarak silebilirsiniz.</p>
          <h3>Üçüncü taraf hizmetler</h3>
          <p>Google giriş betiği (accounts.google.com) yüklendiğinde IP adresiniz ve tarayıcı bilgileriniz Google’a ulaşır, Google kendi çerezlerini kullanabilir; Google’ın gizlilik politikası geçerlidir. “X videosundan ses” özelliğinde yapıştırdığınız gönderinin kimliği api.fxtwitter.com’a, video dosyası ise twimg.com sunucularına istek olarak gider. “Bağlantıdan ekle”de girdiğiniz adrese tarayıcınız doğrudan bağlanır. Bu hizmetler İşletmeci’den bağımsızdır; içeriklerinden ve veri uygulamalarından İşletmeci sorumlu değildir.</p>
          <h3>Çerez ve izleme</h3>
          <p>Uygulama kendisi çerez bırakmaz ve sizi izlemez. Google giriş betiği, yalnızca siz bulut eşitleme için onay verdiğinizde yüklenir.</p>
          <h3>Saklama süresi</h3>
          <p>Cihazdaki veriler siz silene veya tarayıcı verisini temizleyene kadar; bulut verileri siz silene kadar saklanır.</p>
          <h3>Çocuklar</h3>
          <p>18 yaşından küçük kullanıcılar Uygulamayı ancak ebeveyn veya vasilerinin gözetimi ve onayıyla kullanmalıdır; bulut eşitleme küçükler için önerilmez.</p>
          <h3>Güvenlik</h3>
          <p>Bağlantılar HTTPS ile korunur. Buna rağmen hiçbir sistemin mutlak güvenliği garanti edilemez.</p>
        </details>

        <details class="legal-section">
          <summary>KVKK Aydınlatma Metni</summary>
          <!-- Hukuk kontrolü: veri sorumlusunun ticaret unvanı/adı, adresi ve varsa MERSİS/VERBİS bilgisi buraya eklenmelidir. -->
          <p>6698 sayılı Kişisel Verilerin Korunması Kanunu’nun (“KVKK”) 10. maddesi uyarınca bilgilendirilirsiniz.</p>
          <h3>Veri sorumlusu</h3>
          <p>ozguler forge (ozgulerforge.com.tr) · <a href="mailto:iletisim@ozgulerforge.com.tr">iletisim@ozgulerforge.com.tr</a></p>
          <h3>İşlenen kişisel veriler</h3>
          <p>Yalnızca Google ile giriş yapıp bulut eşitleme kullanırsanız: e-posta adresiniz (kimlik/iletişim) ile favori ses adları, dinleme sayıları ve süreleri (kullanım verisi). Hiç giriş yapmazsanız İşletmeci sizin hakkınızda kişisel veri işlemez; cihazınızdaki ses ve ayarlara erişemez.</p>
          <h3>İşleme amaçları</h3>
          <p>Bulut eşitleme hizmetini sunmak, oturumu doğrulamak ve güvenliğini sağlamak, hataları gidermek, hukuki yükümlülükleri yerine getirmek.</p>
          <h3>Hukuki sebepler</h3>
          <p>KVKK m.5/2-c (hizmet sözleşmesinin kurulması ve ifası), m.5/2-ç (hukuki yükümlülük), m.5/2-f (meşru menfaat) ve yurt dışına aktarım bakımından m.9 uyarınca açık rızanız.</p>
          <h3>Aktarım</h3>
          <p>Veriler, hizmet altyapısını sağlayan Google LLC (giriş doğrulama) ve Cloudflare, Inc. (barındırma ve KV depolama) gibi yurt dışındaki hizmet sağlayıcılara aktarılır. Bu aktarım, bulut eşitleme öncesinde verdiğiniz açık rızaya dayanır. Rızanızı dilediğiniz zaman “Çıkış yap” ve “Bulut verimi sil” ile geri alabilirsiniz. Ayrıca mevzuat gereği yetkili kurumların talebi halinde paylaşım yapılabilir. Veriler pazarlama amacıyla kullanılmaz ve satılmaz.</p>
          <h3>Toplama yöntemi</h3>
          <p>Veriler, Uygulama üzerinden otomatik ve elektronik yolla, Google girişiniz ve kullanımınız sırasında toplanır.</p>
          <h3>Haklarınız (KVKK m.11)</h3>
          <p>Kişisel verinizin işlenip işlenmediğini öğrenme; işlenmişse bilgi talep etme; amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme; aktarıldığı üçüncü kişileri bilme; eksik veya yanlış işlenmişse düzeltilmesini isteme; KVKK m.7 çerçevesinde silinmesini veya yok edilmesini isteme ve bunların aktarıldığı üçüncü kişilere bildirilmesini isteme; otomatik analiz sonucu aleyhinize bir sonuca itiraz etme; kanuna aykırı işleme nedeniyle zarara uğramanız halinde zararın giderilmesini talep etme haklarına sahipsiniz.</p>
          <h3>Başvuru</h3>
          <p>Taleplerinizi, Google hesabınızla aynı e-posta adresinden iletisim@ozgulerforge.com.tr adresine yazılı olarak iletebilirsiniz. Başvurular, niteliğine göre en geç otuz gün içinde ücretsiz sonuçlandırılır; işlemin ayrıca maliyet gerektirmesi halinde Kişisel Verileri Koruma Kurulu’nca belirlenen tarife uygulanabilir. Cevabı yetersiz bulursanız Kurul’a şikâyet hakkınız saklıdır (KVKK m.14, kvkk.gov.tr).</p>
        </details>

        <details class="legal-section">
          <summary>Sorumluluk Reddi ve Telif Bildirimi</summary>
          <h3>Sorumluluk reddi</h3>
          <p>Uygulama “olduğu gibi” ve “mevcut haliyle” sunulur; belirli bir amaca uygunluk, kesintisizlik veya hatasızlık garanti edilmez.</p>
          <p>Yürürlükteki mevzuatın izin verdiği azami ölçüde; ozguler forge, ozgulerforge.com.tr alan adı, iletisim@ozgulerforge.com.tr e-posta adresi ve Uygulamayı geliştiren ve işleten kişiler (hepsi birlikte “İşletmeci”): (a) kullanıcıların eklediği, indirdiği, kestiği, dönüştürdüğü veya yedeklediği içeriklerin hukuka ve telif haklarına uygunluğundan ve bu içeriklerin kullanımından doğan sonuçlardan; (b) X, fxtwitter, Google, Cloudflare, tarayıcı, işletim sistemi ve diğer üçüncü taraf hizmetlerin işleyişinden, içeriğinden ve kesintilerinden; (c) tarayıcı verisinin silinmesi, depolama alanının dolması, cihaz arızası, yedek alınmaması veya yedeğin bozulması gibi nedenlerle oluşan veri kaybından; (d) hata, kesinti, uyumsuzluk ve güncellemelerden; (e) dolaylı zararlardan, kâr ve fırsat kaybından; (f) kullanıcının kusurlu veya hukuka aykırı kullanımı nedeniyle üçüncü kişilerce ya da idari, hukuki veya cezai mercilerce ileri sürülen talep ve yaptırımlardan hiçbir şekilde sorumlu değildir.</p>
          <p>Kullanıcı, kendi kullanımı nedeniyle İşletmeci’ye yöneltilecek üçüncü kişi taleplerinde İşletmeci’yi sorumluluktan ari tutmayı ve bu nedenle doğabilecek zararı tazmin etmeyi kabul eder.</p>
          <p>ozgulerforge.com.tr sitesi ve iletisim@ozgulerforge.com.tr adresi yalnızca iletişim kanalıdır; bu kanallara iletilen talepler, İşletmeci adına herhangi bir sorumluluk veya taahhüt doğurmaz.</p>
          <p>Bu bölüm; kast ve ağır kusur hallerinde sorumluluğu, tüketicinin emredici kanuni haklarını ve KVKK kapsamındaki haklarınızı ortadan kaldırmaz. Bir hüküm kısmen geçersiz sayılırsa kalan hükümler geçerliliğini korur.</p>
          <h3>Telif hakkı bildirimi</h3>
          <p>Uygulama içerik barındırmaz; içerikler yalnızca kullanıcının cihazında bulunur. Haklarınızın ihlal edildiğini düşünen hak sahipleri, ihlal eden içeriğin kaynağını ve hak sahipliğini gösteren bilgilerle iletisim@ozgulerforge.com.tr adresine başvurabilir. Hak sahipleri, ihlali doğrudan ilgili kullanıcıya ve içeriği yayımlayan platforma da bildirmelidir.</p>
        </details>
      </div>
    </div>
  </div>

  <!-- ======================== ÇEKMECE 3: SES KESME STÜDYOSU ======================== -->
  <div class="overlay" id="trim-overlay" hidden>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="trim-title">
      <div class="sheet-head"><h2 id="trim-title">Sesi kes</h2><button class="icon-button" id="trim-close" type="button" aria-label="Kapat">${icons.close}</button></div>
      <p class="sheet-sub" id="trim-name"></p>
      <p class="sheet-status" id="trim-status" aria-live="polite"></p>
      <canvas class="wave" id="wave" height="96" aria-label="Ses dalga biçimi"></canvas>
      <div class="trim-field">
        <div class="trim-label"><span>Başlangıç</span><strong id="trim-start-label">00:00.0</strong></div>
        <div class="trim-row"><button class="nudge" type="button" data-nudge="start" data-delta="-1">−1 sn</button><input id="trim-start" type="range" min="0" max="100" step="any" value="0" aria-label="Başlangıç" /><button class="nudge" type="button" data-nudge="start" data-delta="1">+1 sn</button></div>
      </div>
      <div class="trim-field">
        <div class="trim-label"><span>Bitiş</span><strong id="trim-end-label">00:00.0</strong></div>
        <div class="trim-row"><button class="nudge" type="button" data-nudge="end" data-delta="-1">−1 sn</button><input id="trim-end" type="range" min="0" max="100" step="any" value="100" aria-label="Bitiş" /><button class="nudge" type="button" data-nudge="end" data-delta="1">+1 sn</button></div>
      </div>
      <p class="sheet-sub" id="trim-summary"></p>
      <div class="trim-zoom"><label for="wave-zoom">Yakınlaştırma</label><input id="wave-zoom" type="range" min="1" max="8" step="0.5" value="1" /><output id="wave-zoom-value">1×</output></div>
      <div class="trim-effects"><label>Fade-in <span><input id="fade-in" type="range" min="0" max="5" step="0.1" value="0" /><output id="fade-in-value">0 sn</output></span></label><label>Fade-out <span><input id="fade-out" type="range" min="0" max="5" step="0.1" value="0" /><output id="fade-out-value">0 sn</output></span></label><label>Bas <span><input id="trim-bass" type="range" min="-12" max="12" step="1" value="0" /><output id="trim-bass-value">0 dB</output></span></label><label>Tiz <span><input id="trim-treble" type="range" min="-12" max="12" step="1" value="0" /><output id="trim-treble-value">0 dB</output></span></label></div>
      <label class="consent sheet-check"><input id="trim-keep" type="checkbox" checked /><span>Orijinal ses arşivde kalsın</span></label>
      <div class="sheet-actions"><button class="ghost-button" id="trim-preview" type="button" disabled>Seçimi dinle</button><button class="primary-button" id="trim-save" type="button" disabled>${icons.scissors}<span>Kes ve kaydet</span></button></div>
    </div>
  </div>

  <!-- ======================== ÇEKMECE 4: KAYIT BİLGİSİ ======================== -->
  <div class="overlay" id="info-overlay" hidden>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="info-title">
      <div class="sheet-head"><h2 id="info-title">Kayıt bilgisi</h2><button class="icon-button" id="info-close" type="button" aria-label="Kapat">${icons.close}</button></div>
      <div id="info-body"></div>
      <div class="sheet-actions"><button class="ghost-button" id="info-share" type="button" hidden>${icons.share}<span>Paylaş</span></button><button class="primary-button" id="info-ok" type="button">Tamam</button></div>
    </div>
  </div>

  <!-- ======================== ÇEKMECE 5: ADI DEĞİŞTİR ======================== -->
  <div class="overlay" id="rename-overlay" hidden>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rename-title">
      <div class="sheet-head"><h2 id="rename-title">Adı değiştir</h2><button class="icon-button" id="rename-close" type="button" aria-label="Kapat">${icons.close}</button></div>
      <label class="sr-only" for="rename-input">Yeni ad</label>
      <input class="text-input" id="rename-input" type="text" maxlength="80" autocomplete="off" />
      <div class="sheet-actions rename-actions"><button class="primary-button" id="rename-save" type="button">Kaydet</button></div>
    </div>
  </div>

  <!-- ======================== ÇEKMECE 6: KLASÖRE TAŞI ======================== -->
  <div class="overlay" id="category-overlay" hidden>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="category-title">
      <div class="sheet-head"><h2 id="category-title">Klasöre taşı</h2><button class="icon-button" id="category-close" type="button" aria-label="Kapat">${icons.close}</button></div>
      <p class="sheet-sub" id="category-song"></p>
      <div class="category-options" id="category-options"></div>
    </div>
  </div>

  <!-- ======================== ÇEKMECE 7: KLASÖRLERİ DÜZENLE ======================== -->
  <div class="overlay" id="folders-overlay" hidden>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="folders-title">
      <div class="sheet-head"><h2 id="folders-title">Klasörler</h2><button class="icon-button" id="folders-close" type="button" aria-label="Kapat">${icons.close}</button></div>
      <p class="sheet-sub">Kendi klasörlerini ekle, adını değiştir ya da sil. Klasör silinince içindeki sesler silinmez, klasörsüz kalır.</p>
      <div class="folder-add-row"><input class="text-input" id="folder-name-input" type="text" maxlength="24" placeholder="Yeni klasör adı" autocomplete="off" /><button class="primary-button" id="folder-add-button" type="button">Ekle</button></div>
      <div class="folder-manage-list" id="folders-list"></div>
    </div>
  </div>

  <div class="toast" id="toast" role="status"></div>
`;
function placeListeningStatsPanel() {
    // Keep listening stats neatly inside the Profile & Backup sheet
}
window.addEventListener('resize', placeListeningStatsPanel);
placeListeningStatsPanel();
const fileInput = get('file-input');
const fileName = get('file-name');
const consent = get('consent');
const addButton = get('add-button');
const urlInput = get('url-input');
const xVideoPanel = get('x-video-panel');
const xVideoUrl = get('x-video-url');
const xVideoFind = get('x-video-find');
const xVideoStatus = get('x-video-status');
const xVideoResults = get('x-video-results');
const progressWrap = get('progress-wrap');
const progress = get('progress');
const progressLabel = get('progress-label');
const progressValue = get('progress-value');
const songList = get('song-list');
const emptyState = get('empty-state');
const libraryCount = get('library-count');
const player = get('player');
const playerTitle = get('player-title');
const playerSubtitle = get('player-subtitle');
const playerEqualizer = get('player-equalizer');
const playButton = get('play-button');
const seek = get('seek');
const timeLabel = get('time');
const trimOverlay = get('trim-overlay');
const trimName = get('trim-name');
const trimStatus = get('trim-status');
const waveCanvas = get('wave');
const trimStart = get('trim-start');
const trimEnd = get('trim-end');
const trimStartLabel = get('trim-start-label');
const trimEndLabel = get('trim-end-label');
const trimSummary = get('trim-summary');
const trimKeep = get('trim-keep');
const trimPreviewButton = get('trim-preview');
const trimSaveButton = get('trim-save');
const infoOverlay = get('info-overlay');
const categoryOverlay = get('category-overlay');
const folderBar = get('folder-bar');
const listenAllButton = get('listen-all');
const addFolder = get('add-folder');
const categoryOptions = get('category-options');
const foldersOverlay = get('folders-overlay');
const foldersList = get('folders-list');
const folderNameInput = get('folder-name-input');
const urlClear = get('url-clear');
const xVideoClear = get('x-video-clear');
const infoBody = get('info-body');
const infoShareButton = get('info-share');
const statsPanel = get('listening-stats-panel');
const statsToggle = get('stats-toggle');
function setStatsExpanded(expanded) {
    statsPanel.classList.toggle('is-collapsed', !expanded);
    statsToggle.setAttribute('aria-expanded', String(expanded));
    statsToggle.querySelector('span').textContent = expanded ? 'Gizle' : 'Göster';
}
setStatsExpanded(false);
statsToggle.addEventListener('click', () => {
    const expanded = statsToggle.getAttribute('aria-expanded') === 'true';
    setStatsExpanded(!expanded);
});
function get(selector) {
    const element = document.querySelector(`#${selector}`);
    if (!element)
        throw new Error(`Eksik arayüz öğesi: ${selector}`);
    return element;
}
let dbPromise = null;
function openDatabase() {
    if (dbPromise)
        return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        request.onsuccess = () => {
            const db = request.result;
            db.onversionchange = () => { db.close(); dbPromise = null; };
            resolve(db);
        };
        request.onerror = () => { dbPromise = null; reject(request.error ?? new Error('Yerel arşiv açılamadı.')); };
    });
    return dbPromise;
}
async function dbGetAll() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt - a.createdAt));
        request.onerror = () => reject(request.error ?? new Error('Sesler okunamadı.'));
    });
}
async function dbPut(song) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(song);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error('Ses cihazda saklanamadı.'));
    });
}
async function dbDelete(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error('Ses silinemedi.'));
    });
}
function formatTime(value) {
    if (!Number.isFinite(value) || value < 0)
        return '00:00';
    const seconds = Math.floor(value);
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
function formatSize(bytes) {
    if (bytes < 1024 * 1024)
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function readListeningStats() {
    try {
        const keys = [LISTENING_STATS_KEY, 'sescebi-listening-stats', 'sescebi-stats-v1', 'sescebi-play-stats'];
        let raw = '';
        for (const key of keys) {
            raw = window.localStorage.getItem(key) || window.sessionStorage.getItem(key) || '';
            if (raw) break;
        }
        const parsed = JSON.parse(raw || '{}');
        const tracks = Object.create(null);
        const source = parsed?.tracks && typeof parsed.tracks === 'object' ? parsed.tracks : parsed?.songs && typeof parsed.songs === 'object' ? parsed.songs : {};
        if (source && typeof source === 'object') {
            for (const [id, entry] of Object.entries(source)) {
                if (!entry || typeof entry !== 'object') continue;
                const plays = Number(entry.plays ?? entry.playCount ?? entry.count);
                const seconds = Number(entry.seconds ?? entry.listenSeconds ?? entry.durationListened);
                tracks[String(id)] = { key: typeof entry.key === 'string' ? entry.key : '', name: typeof entry.name === 'string' ? entry.name : typeof entry.title === 'string' ? entry.title : 'Ses kaydı', plays: Math.max(0, Number.isFinite(plays) ? plays : 0), seconds: Math.max(0, Number.isFinite(seconds) ? seconds : 0) };
            }
        }
        return { tracks };
    } catch { return { tracks: Object.create(null) }; }
}
function persistListeningStats() {
    const serialized = JSON.stringify(listeningStats);
    try { window.localStorage.setItem(LISTENING_STATS_KEY, serialized); } catch { /* özel modda oturum yedeği kullanılabilir */ }
    try { window.sessionStorage.setItem(LISTENING_STATS_KEY, serialized); } catch { /* depolama tamamen kapalı olabilir */ }
    renderListeningStats();
    cloudSync?.notifyChange();
}
function formatListeningTime(value) {
    const seconds = Math.max(0, Math.floor(value));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours) return `${hours} sa ${minutes} dk`;
    if (minutes) return `${minutes} dk`;
    return `${seconds} sn`;
}
function renderListeningStats() {
    if (!document.querySelector('#stat-play-count')) return;
    const entries = Object.entries(listeningStats.tracks);
    const totalPlays = entries.reduce((sum, [, item]) => sum + item.plays, 0);
    const totalSeconds = entries.reduce((sum, [, item]) => sum + item.seconds, 0);
    const played = entries.filter(([, item]) => item.plays > 0);
    const top = played.sort((a, b) => b[1].plays - a[1].plays || b[1].seconds - a[1].seconds)[0];
    get('stat-play-count').textContent = String(totalPlays);
    get('stat-listen-time').textContent = formatListeningTime(totalSeconds);
    get('stat-unique-tracks').textContent = String(played.length);
    const topButton = get('stat-top-track');
    const topSong = top ? songs.find((song) => String(song.id) === top[0]) : null;
    topButton.textContent = topSong?.name || (top ? top[1].name : 'Henüz yok');
    topButton.dataset.songId = topSong?.id || '';
    topButton.disabled = !topSong;
    get('stat-top-play-count').textContent = top ? `${top[1].plays} kez çalındı` : 'Bir ses çaldığında burada';
}
function jumpToTopTrack() {
    const button = get('stat-top-track');
    const song = songs.find((item) => item.id === button?.dataset.songId);
    if (!song) return;
    document.querySelector('[data-screen="library"]')?.click();
    renderLibrary();
    window.setTimeout(() => {
        const row = [...songList.querySelectorAll('.song-row')].find((item) => item.dataset.songId === String(song.id));
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row?.classList.add('highlight-song-row');
        window.setTimeout(() => row?.classList.remove('highlight-song-row'), 1800);
        void playSong(song);
    }, 80);
}
function startListeningSession() {
    if (!activeSong || listeningSession) return;
    const id = String(activeSong.id);
    const entry = listeningStats.tracks[id] || { name: activeSong.name, plays: 0, seconds: 0 };
    entry.name = activeSong.name;
    entry.key = songKey(activeSong);
    entry.plays += 1;
    listeningStats.tracks[id] = entry;
    listeningSession = { id, startedAt: performance.now() };
    persistListeningStats();
}
function flushListeningSession(endSession = false) {
    if (!listeningSession) return;
    const now = performance.now();
    const elapsed = Math.max(0, now - listeningSession.startedAt) / 1000;
    const entry = listeningStats.tracks[listeningSession.id];
    if (entry) entry.seconds += elapsed;
    if (endSession) listeningSession = null;
    else listeningSession.startedAt = now;
    if (elapsed > 0) persistListeningStats();
}
function toast(message, error = false) {
    const node = get('toast');
    window.clearTimeout(toastTimer);
    node.textContent = message;
    node.className = `toast show${error ? ' error' : ''}`;
    toastTimer = window.setTimeout(() => { node.className = 'toast'; }, 4200);
}
function setProgress(label, value, visible = true) {
    progressWrap.classList.toggle('visible', visible);
    progressLabel.textContent = label;
    progress.value = value;
    progressValue.textContent = `${Math.round(value)}%`;
}
function updateAddButton() {
    const hasSource = activeTab === 'file' ? Boolean(selectedFile) : Boolean(urlInput.value.trim());
    addButton.hidden = activeTab === 'x-video';
    addButton.disabled = activeTab === 'x-video' || !consent.checked || !hasSource;
}
function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('[data-tab]').forEach((button) => {
        const selected = button.dataset.tab === tab;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-selected', String(selected));
    });
    get('file-panel').hidden = tab !== 'file';
    get('url-panel').hidden = tab !== 'url';
    xVideoPanel.hidden = tab !== 'x-video';
    updateAddButton();
}
function isBlockedHost(hostname) {
    const host = hostname.toLowerCase();
    return host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagram.net' || host.endsWith('.instagram.net') || host.endsWith('.cdninstagram.com');
}
function validateDirectUrl(raw) {
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        throw new Error('Geçerli bir http veya https bağlantısı gir.');
    }
    if (!['http:', 'https:'].includes(url.protocol))
        throw new Error('Yalnızca http veya https bağlantıları kullanılabilir.');
    if (isBlockedHost(url.hostname)) {
        throw new Error('Instagram sayfaları veya korumalı medya bağlantıları desteklenmiyor. Doğrudan ve izinli bir ses dosyası bağlantısı kullan.');
    }
    return url;
}
function fileBaseName(name) {
    const withoutExt = name.replace(/\.[^/.]+$/, '').trim();
    return withoutExt || 'İsimsiz ses';
}
function urlBaseName(url) {
    const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '').replace(/\.[^/.]+$/, '').trim();
    return last || 'Bağlantıdan kaydedilen ses';
}
function getDuration(blob) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(blob);
        const probe = new Audio();
        probe.preload = 'metadata';
        probe.onloadedmetadata = () => { const value = Number.isFinite(probe.duration) ? probe.duration : 0; URL.revokeObjectURL(url); resolve(value); };
        probe.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
        probe.src = url;
    });
}
async function looksLikeAudio(blob) {
    const bytes = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    const startsWith = (value) => text.startsWith(value);
    const isRiffWave = startsWith('RIFF') && text.slice(8, 12) === 'WAVE';
    const isFtyp = text.slice(4, 8) === 'ftyp';
    const isMp3Frame = bytes.length > 1 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
    const isWebm = bytes.length > 3 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
    return startsWith('ID3') || isRiffWave || startsWith('OggS') || startsWith('fLaC') || isFtyp || isMp3Frame || isWebm;
}
async function normalizeAudioBlob(blob, declaredType) {
    const type = (blob.type || declaredType || '').toLowerCase();
    if (type.startsWith('audio/'))
        return { blob, type };
    if ((type === '' || type === 'application/octet-stream') && await looksLikeAudio(blob)) {
        return { blob: new Blob([blob], { type: 'audio/mpeg' }), type: 'audio/mpeg' };
    }
    throw new Error('Bu bağlantı gerçek bir ses dosyası gibi görünmüyor.');
}
async function readUrlBlob(url) {
    let response;
    try {
        response = await fetch(url.href, { mode: 'cors' });
    }
    catch {
        throw new Error('Bağlantıya erişilemedi. Dosya herkese açık ve CORS erişimine izin veriyor olmalı.');
    }
    if (!response.ok)
        throw new Error(`Bağlantı ses dosyasını vermedi (HTTP ${response.status}).`);
    if (isBlockedHost(new URL(response.url).hostname))
        throw new Error('Bağlantı Instagram veya korumalı bir hedefe yönlendirildi.');
    const declaredType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || '';
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_SIZE)
        throw new Error('Bu dosya 100 MB sınırını aşıyor.');
    if (declaredType && !declaredType.startsWith('audio/') && declaredType !== 'application/octet-stream')
        throw new Error('Bu bağlantı bir ses dosyası gibi görünmüyor.');
    if (!response.body) {
        const blob = await response.blob();
        if (blob.size > MAX_SIZE)
            throw new Error('Bu dosya 100 MB sınırını aşıyor.');
        return normalizeAudioBlob(blob, declaredType);
    }
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
        const part = await reader.read();
        if (part.done)
            break;
        if (part.value) {
            const copy = new Uint8Array(part.value.byteLength);
            copy.set(part.value);
            chunks.push(copy.buffer);
            received += part.value.byteLength;
            if (received > MAX_SIZE) {
                await reader.cancel();
                throw new Error('Bu dosya 100 MB sınırını aşıyor.');
            }
            const percent = length ? (received / length) * 100 : Math.min(95, (received / MAX_SIZE) * 100);
            setProgress('Bağlantıdan alınıyor…', percent);
        }
    }
    const blob = new Blob(chunks, { type: declaredType || 'application/octet-stream' });
    if (!blob.size)
        throw new Error('Boş bir dosya alındı.');
    return normalizeAudioBlob(blob, declaredType);
}
const X_API = 'https://api.fxtwitter.com/status/';
let xVideoVariants = [];
function extractXId(raw) {
    const value = String(raw || '').trim();
    if (/^\d{8,25}$/.test(value)) return value;
    return value.match(/\/(?:status|statuses)\/(\d{8,25})/i)?.[1] || '';
}
function safeXMedia(raw) {
    try {
        const url = new URL(raw);
        return url.protocol === 'https:' && /(^|\.)twimg\.com$/i.test(url.hostname);
    }
    catch { return false; }
}
function xVariants(video) {
    const raw = Array.isArray(video?.formats) ? video.formats : Array.isArray(video?.variants) ? video.variants : [];
    const seen = new Set();
    const result = [];
    const add = (item) => {
        const url = typeof item === 'string' ? item : item?.url;
        if (!safeXMedia(url) || !/\.mp4(?:\?|$)/i.test(url) || seen.has(url)) return;
        seen.add(url);
        const size = url.match(/\/(\d{2,5})x(\d{2,5})\//);
        result.push({ url, width: size ? Number(size[1]) : 0, height: size ? Number(size[2]) : 0, bitrate: Number(item?.bitrate) || 0 });
    };
    raw.forEach(add);
    add(video?.url);
    return result.sort((a, b) => Math.min(b.width || 0, b.height || 0) - Math.min(a.width || 0, a.height || 0) || b.bitrate - a.bitrate);
}
function setXVideoStatus(message, error = false) {
    xVideoStatus.textContent = message;
    xVideoStatus.classList.toggle('error', error);
}
function xQualityLabel(item, index) {
    const quality = item.height || item.width;
    return quality ? `${quality}p${item.bitrate ? ` · ${Math.round(item.bitrate / 1000)} kb/sn` : ''}` : (index ? `Seçenek ${index + 1}` : 'Varsayılan');
}
function renderXVideos(tweet) {
    const tweets = [tweet, tweet?.quote].filter(Boolean);
    xVideoVariants = tweets.flatMap((entry, tweetIndex) => ((entry.media?.videos || []).map((video) => ({ ...video, variants: xVariants(video), label: tweetIndex ? 'Alıntılanan gönderi' : '' })))).filter((video) => video.variants.length);
    xVideoResults.replaceChildren();
    if (!xVideoVariants.length) {
        setXVideoStatus('Bu gönderide indirilebilir video bulunamadı.', true);
        return;
    }
    setXVideoStatus(`${xVideoVariants.length} video bulundu. Kaliteyi seçip indir veya sesini arşive ekle.`);
    xVideoVariants.forEach((video, index) => {
        const card = document.createElement('article');
        card.className = 'x-video-result';
        const preview = document.createElement('video');
        preview.controls = true;
        preview.playsInline = true;
        preview.preload = 'metadata';
        preview.src = video.variants[0].url;
        const meta = document.createElement('div');
        meta.className = 'x-video-result-meta';
        const title = document.createElement('strong');
        title.textContent = video.label || `Video ${index + 1}`;
        meta.append(title);
        const select = document.createElement('select');
        select.className = 'text-input';
        select.dataset.xQuality = String(index);
        video.variants.forEach((variant, qualityIndex) => select.add(new Option(xQualityLabel(variant, qualityIndex), String(qualityIndex))));
        select.addEventListener('change', () => { preview.src = video.variants[Number(select.value)].url; });
        meta.append(select);
        const actions = document.createElement('div');
        actions.className = 'x-video-actions';
        const download = document.createElement('button');
        download.className = 'primary-button'; download.type = 'button'; download.textContent = 'Videoyu indir'; download.dataset.xAction = 'download'; download.dataset.xIndex = String(index);
        const archive = document.createElement('button');
        archive.className = 'ghost-button'; archive.type = 'button'; archive.textContent = 'Sesi arşive ekle'; archive.dataset.xAction = 'archive'; archive.dataset.xIndex = String(index);
        actions.append(download, archive);
        card.append(preview, meta, actions);
        xVideoResults.append(card);
    });
}
async function fetchXVideoBlob(variant) {
    const response = await fetch(variant.url, { mode: 'cors', referrerPolicy: 'no-referrer', credentials: 'omit' });
    if (!response.ok) throw new Error(`Video sunucusu HTTP ${response.status} yanıtı verdi.`);
    const blob = await response.blob();
    if (!blob.size) throw new Error('Boş video dosyası alındı.');
    if (blob.size > MAX_SIZE) throw new Error('Video 100 MB sınırını aşıyor.');
    return new Blob([blob], { type: 'video/mp4' });
}
async function downloadXVideo(index) {
    const video = xVideoVariants[index];
    if (!video) return;
    const select = xVideoResults.querySelector(`[data-x-quality="${index}"]`);
    const variant = video.variants[Number(select?.value) || 0];
    try {
        setXVideoStatus('Video indiriliyor…');
        const blob = await fetchXVideoBlob(variant);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url; anchor.download = `ses-cebi-x-${Date.now()}.mp4`;
        document.body.append(anchor); anchor.click(); anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        setXVideoStatus('Video indirildi.');
        toast('X videosu cihazına indirildi.');
    }
    catch (error) { setXVideoStatus(error instanceof Error ? error.message : 'Video indirilemedi. Ağ veya CORS kısıtı olabilir.', true); }
}
async function archiveXVideoAudio(index) {
    const video = xVideoVariants[index];
    if (!video) return;
    const select = xVideoResults.querySelector(`[data-x-quality="${index}"]`);
    const variant = video.variants[Number(select?.value) || 0];
    try {
        setXVideoStatus('Video alınıyor ve sesi hazırlanıyor…');
        const blob = await fetchXVideoBlob(variant);
        const file = new File([blob], `x-video-${Date.now()}.mp4`, { type: 'video/mp4' });
        const audioBlob = await extractVideoAudio(file);
        const song = await createSong(audioBlob, `X video sesi ${new Date().toLocaleDateString('tr-TR')}.wav`, 'x-video');
        if (addCategory)
            song.category = addCategory;
        await dbPut(song);
        songs = [song, ...songs];
        renderLibrary();
        setXVideoStatus('Videonun sesi arşive eklendi.');
        clearXField(false);
        toast(addCategory ? `X videosunun sesi “${categoryLabel(addCategory)}” klasörüne eklendi.` : 'X videosunun sesi arşive eklendi.');
    }
    catch (error) { setXVideoStatus(error instanceof Error ? error.message : 'Videonun sesi arşive eklenemedi.', true); }
}
async function findXVideos() {
    const id = extractXId(xVideoUrl.value);
    xVideoResults.replaceChildren(); xVideoVariants = [];
    if (!id) { setXVideoStatus('Geçerli bir x.com veya twitter.com gönderi bağlantısı gir.', true); return; }
    xVideoFind.disabled = true;
    setXVideoStatus('X gönderisi okunuyor…');
    try {
        const response = await fetch(`${X_API}${id}`, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(response.status === 404 ? 'Gönderi bulunamadı; silinmiş veya gizli olabilir.' : `X servisi HTTP ${response.status} yanıtı verdi.`);
        const data = await response.json();
        if (!data?.tweet) throw new Error('Gönderi verisi alınamadı.');
        renderXVideos(data.tweet);
    }
    catch (error) { setXVideoStatus(error instanceof Error ? error.message : 'X gönderisi okunamadı.', true); }
    finally { xVideoFind.disabled = false; }
}
xVideoFind.addEventListener('click', () => void findXVideos());
xVideoUrl.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); void findXVideos(); } });
xVideoResults.addEventListener('click', (event) => {
    const button = event.target.closest('[data-x-action]');
    if (!button) return;
    if (button.dataset.xAction === 'download') void downloadXVideo(Number(button.dataset.xIndex));
    if (button.dataset.xAction === 'archive') void archiveXVideoAudio(Number(button.dataset.xIndex));
});
const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv)$/i;
function isVideoFile(file) {
    return file.type.startsWith('video/') || VIDEO_EXT.test(file.name);
}
function decodeAudio(ctx, data) {
    // Eski Safari sürümleri için geri çağırmalı biçim de kullanılır.
    return new Promise((resolve, reject) => {
        try {
            ctx.decodeAudioData(data, resolve, reject)?.then?.(resolve, reject);
        }
        catch (error) {
            reject(error);
        }
    });
}
function encodeWav(buffer, from = 0, to = buffer.length, fades = { fadeIn: 0, fadeOut: 0 }) {
    const channels = Math.min(2, buffer.numberOfChannels);
    const length = to - from;
    const sampleRate = buffer.sampleRate;
    const dataSize = length * channels * 2;
    const out = new ArrayBuffer(44 + dataSize);
    const view = new DataView(out);
    const writeText = (offset, text) => { for (let i = 0; i < text.length; i++)
        view.setUint8(offset + i, text.charCodeAt(i)); };
    writeText(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeText(8, 'WAVE');
    writeText(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    writeText(36, 'data');
    view.setUint32(40, dataSize, true);
    const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
    let offset = 44;
    for (let i = 0; i < length; i++) {
        for (let c = 0; c < channels; c++) {
            let gain = 1;
            const seconds = i / sampleRate;
            const remaining = (length - i) / sampleRate;
            if (fades.fadeIn > 0) gain = Math.min(gain, Math.min(1, seconds / fades.fadeIn));
            if (fades.fadeOut > 0) gain = Math.min(gain, Math.min(1, remaining / fades.fadeOut));
            const sample = Math.max(-1, Math.min(1, data[c][from + i] * gain));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
            offset += 2;
        }
    }
    return new Blob([out], { type: 'audio/wav' });
}
let lamePromise = null;
function loadLame() {
    if (window.lamejs)
        return Promise.resolve(window.lamejs);
    if (lamePromise)
        return lamePromise;
    lamePromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'lame.min.js';
        script.onload = () => window.lamejs ? resolve(window.lamejs) : reject(new Error('MP3 kodlayıcı bulunamadı.'));
        script.onerror = () => { lamePromise = null; reject(new Error('MP3 kodlayıcı yüklenemedi.')); };
        document.head.appendChild(script);
    });
    return lamePromise;
}
function toInt16(source) {
    const out = new Int16Array(source.length);
    for (let i = 0; i < source.length; i++) {
        const sample = Math.max(-1, Math.min(1, source[i]));
        out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return out;
}
async function encodeMp3(buffer) {
    const lame = await loadLame();
    const channels = Math.min(2, buffer.numberOfChannels);
    const encoder = new lame.Mp3Encoder(channels, buffer.sampleRate, 128);
    const left = toInt16(buffer.getChannelData(0));
    const right = channels === 2 ? toInt16(buffer.getChannelData(1)) : undefined;
    const block = 1152 * 20;
    const parts = [];
    for (let start = 0, n = 0; start < left.length; start += block, n++) {
        const chunk = right ? encoder.encodeBuffer(left.subarray(start, start + block), right.subarray(start, start + block)) : encoder.encodeBuffer(left.subarray(start, start + block));
        if (chunk.length)
            parts.push(new Uint8Array(chunk));
        if (n % 25 === 0) {
            setProgress('MP3 hazırlanıyor…', 75 + (start / left.length) * 15);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }
    const tail = encoder.flush();
    if (tail.length)
        parts.push(new Uint8Array(tail));
    return new Blob(parts, { type: 'audio/mpeg' });
}
async function extractAudioFromVideo(file) {
    setProgress('Video okunuyor…', 15);
    const data = await file.arrayBuffer();
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    let decoded;
    try {
        setProgress('Videodan ses ayrılıyor…', 40);
        decoded = await decodeAudio(ctx, data);
    }
    catch {
        throw new Error('Videodaki ses okunamadı. Videoda ses kanalı olmayabilir veya tarayıcın bu biçimi desteklemiyor (MP4/H.264+AAC dene).');
    }
    finally {
        ctx.close().catch(() => undefined);
    }
    if (!decoded.length || decoded.duration <= 0)
        throw new Error('Videoda ses bulunamadı.');
    setProgress('MP3 hazırlanıyor…', 75);
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
        return await encodeMp3(decoded);
    }
    catch {
        // MP3 kodlayıcı yüklenemezse (ör. ilk açılışta internet yoksa) WAV'a düşülür.
        return encodeWav(decoded);
    }
}
async function createSong(blob, name, source) {
    const declaredType = blob.type.toLowerCase();
    const type = declaredType.startsWith('audio/') ? declaredType : (await looksLikeAudio(blob) ? 'audio/mpeg' : '');
    if (!type)
        throw new Error('Bu dosya gerçek bir ses içermiyor veya desteklenmiyor.');
    const normalizedBlob = type === declaredType ? blob : new Blob([blob], { type });
    const duration = await getDuration(normalizedBlob);
    if (duration <= 0)
        throw new Error('Ses dosyası okunamadı veya tarayıcı tarafından desteklenmiyor.');
    return { id: crypto.randomUUID(), name: fileBaseName(name), blob: normalizedBlob, type, size: normalizedBlob.size, duration, createdAt: Date.now(), source };
}
async function addSelectedAudio() {
    if (!consent.checked) {
        toast('Devam etmek için kullanım hakkını onayla.', true);
        return;
    }
    addButton.disabled = true;
    setProgress('Hazırlanıyor…', 8);
    try {
        let blob;
        let name;
        let source = activeTab;
        if (activeTab === 'file') {
            if (!selectedFile)
                throw new Error('Önce bir ses veya video dosyası seç.');
            const isVideo = isVideoFile(selectedFile);
            if (!isVideo && !selectedFile.type.startsWith('audio/') && !/\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(selectedFile.name))
                throw new Error('Bu dosya desteklenen bir ses veya video formatında değil.');
            if (selectedFile.size > MAX_SIZE)
                throw new Error('Bu dosya 100 MB sınırını aşıyor.');
            name = selectedFile.name;
            if (isVideo) {
                blob = await extractVideoAudio(selectedFile);
            }
            else {
                blob = selectedFile;
            }
            setProgress('Cihaza kaydediliyor…', 90);
        }
        else {
            const url = validateDirectUrl(urlInput.value.trim());
            name = urlBaseName(url);
            const result = await readUrlBlob(url);
            blob = result.blob;
        }
        const song = await createSong(blob, name, source);
        if (addCategory)
            song.category = addCategory;
        await dbPut(song);
        songs = [song, ...songs];
        renderLibrary();
        resetSource();
        setProgress('Kaydedildi', 100);
        toast(addCategory ? `Ses “${categoryLabel(addCategory)}” klasörüne eklendi.` : 'Ses cihazdaki arşivine eklendi.');
        window.setTimeout(() => setProgress('', 0, false), 850);
    }
    catch (error) {
        setProgress('', 0, false);
        if (error instanceof DOMException && error.name === 'QuotaExceededError')
            toast('Cihaz depolaması dolu. Eski kayıtları silip tekrar dene.', true);
        else
            toast(error instanceof Error ? error.message : 'Ses eklenirken beklenmeyen bir sorun oluştu.', true);
    }
    finally {
        updateAddButton();
    }
}
function resetSource() {
    setSelectedFile(null);
    fileInput.value = '';
    urlInput.value = '';
    syncClearButtons();
    consent.checked = false;
    updateAddButton();
}
// Açık ⋯ menüsünü kapatır ve satırına geri koyar.
function closeSongMenus() {
    document.querySelectorAll('.song-more-actions.menu-portal').forEach((menu) => {
        menu.hidden = true;
        menu.classList.remove('menu-portal');
        menu._home?.appendChild(menu);
    });
    document.querySelectorAll('.song-row.menu-open').forEach((row) => {
        row.classList.remove('menu-open');
        row.querySelector('.more-row')?.setAttribute('aria-expanded', 'false');
    });
}
document.addEventListener('pointerdown', (event) => { if (!event.target.closest?.('.song-more-actions, .more-row')) closeSongMenus(); });
window.addEventListener('scroll', closeSongMenus, { capture: true, passive: true });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeSongMenus(); });
function renderLibrary() {
    cloudSync?.libraryRendered();
    document.querySelectorAll('.song-more-actions.menu-portal').forEach((menu) => menu.remove());
    const search = searchQuery.trim().toLocaleLowerCase('tr');
    let visibleSongs = songs.filter((song) => (!favoritesOnly || song.favorite) && inFolder(song) && (!search || song.name.toLocaleLowerCase('tr').includes(search)));
    visibleSongs = [...visibleSongs].sort((a, b) => sortMode === 'oldest' ? a.createdAt - b.createdAt : sortMode === 'az' ? a.name.localeCompare(b.name, 'tr') : sortMode === 'duration' ? (b.duration || 0) - (a.duration || 0) : b.createdAt - a.createdAt);
    lastVisibleSongs = visibleSongs;
    renderFolderBar();
    listenAllButton.hidden = visibleSongs.length === 0 || studioSelectionMode;
    listenAllButton.setAttribute('aria-label', `Görünen ${visibleSongs.length} kaydı sırayla dinle`);
    libraryCount.textContent = visibleSongs.length === songs.length ? `${songs.length} kayıt` : `${songs.length} kayıt · ${visibleSongs.length} gösteriliyor`;
    get('nav-count').textContent = String(songs.length);
    get('stat-count').textContent = String(songs.length);
    get('stat-favorites').textContent = String(songs.filter((song) => song.favorite).length);
    get('stat-storage').textContent = songs.length ? formatSize(songs.reduce((sum, song) => sum + (song.size || 0), 0)) : '0 B';
    renderListeningStats();
    const recent = get('dashboard-recent');
    const recentSongs = [...songs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
    recent.innerHTML = recentSongs.map((song, index) => `<button class="recent-row" type="button" data-play-recent="${song.id}"><span class="recent-cover">${icons.cassette}</span><span class="recent-track"><strong>${escapeHtml(song.name)}</strong><small>${formatTime(song.duration)} <i>·</i> ${formatSize(song.size)}</small></span><span class="recent-play">${icons.play}</span></button>`).join('');
    get('dashboard-empty').hidden = songs.length > 0;
    recent.hidden = songs.length === 0;
    recent.querySelectorAll('[data-play-recent]').forEach((button) => button.addEventListener('click', () => {
        const song = songs.find((item) => item.id === button.dataset.playRecent);
        if (song) {
            if (activeSong?.id !== song.id) { queueIds = null; listenAll = false; }
            void toggleSong(song);
        }
    }));
    emptyState.hidden = visibleSongs.length > 0;
    if (songs.length > 0 && visibleSongs.length === 0) { emptyState.querySelector('h3').textContent = 'Eşleşen kayıt bulunamadı'; emptyState.querySelector('p').textContent = (categoryFilter !== 'all' && !search && !favoritesOnly) ? 'Bu klasör boş. Bir kaydın ⋯ menüsünden “Klasöre taşı”yı seç.' : 'Arama sözcüğünü, favori filtresini veya klasörü değiştirebilirsin.'; }
    else { emptyState.querySelector('h3').textContent = 'Arşivin yeni başlıyor'; emptyState.querySelector('p').textContent = 'İlk kaydını eklediğinde, burada düzenli ve çevrimdışı erişilebilir şekilde göreceksin.'; }
    songList.innerHTML = visibleSongs.map((song) => {
      const isPlayingThis = activeSong?.id === song.id && !audio.paused;
      const dateText = new Date(song.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
      const folderLabel = categoryLabel(song.category);
      const metaLine = `${dateText} · ${formatTime(song.duration)} · ${formatSize(song.size)}${folderLabel ? ` · ${escapeHtml(folderLabel)}` : ''}`;
      return `
      <article class="song-row ${isPlayingThis ? 'is-playing-row' : ''}" data-song-id="${song.id}">
        <button class="compact-thumb play-row" type="button" aria-label="${isPlayingThis ? 'Duraklat' : 'Dinle'}: ${escapeHtml(song.name)}">
          ${isPlayingThis ? icons.pause : icons.play}
        </button>
        <div class="song-main">
          <p class="song-name" title="${escapeHtml(song.name)}">${escapeHtml(song.name)}</p>
          <div class="song-meta"><span>${metaLine}</span></div>
        </div>
        <div class="song-actions">
          <button class="primary-button studio-select-row" type="button" hidden>${icons.scissors}<span>Seç</span></button>
          <button class="icon-button favorite-row ${song.favorite ? 'is-favorite' : ''}" type="button" aria-label="${song.favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}">${song.favorite ? icons.heartFill : icons.heart}</button>
          <button class="icon-button more-row" type="button" aria-label="Daha fazla işlem" aria-expanded="false">${icons.more}</button>
          <div class="song-more-actions" hidden><button class="rename-row" type="button">${icons.edit}<span>Yeniden adlandır</span></button><button class="folder-row" type="button">${icons.folder}<span>Klasöre taşı</span></button><button class="trim-row" type="button">${icons.scissors}<span>Sesi kes</span></button><button class="share-row" type="button">${icons.share}<span>Paylaş</span></button><button class="download-row" type="button">${icons.download}<span>İndir</span></button><button class="delete-row" type="button">${icons.trash}<span>Sil</span></button></div>
        </div>
      </article>`;
    }).join('');
    songList.querySelectorAll('.song-row').forEach((row) => {
        const id = row.dataset.songId;
        const song = songs.find((item) => item.id === id);
        if (!song) return;
        const studioButton = row.querySelector('.studio-select-row');
        const rowActions = row.querySelector('.song-actions');
        const actionMenu = row.querySelector('.song-more-actions');
        rowActions?.classList.toggle('studio-picking', studioSelectionMode);
        row.querySelectorAll('.favorite-row, .play-row, .quick-trim-row, .more-row').forEach((control) => { control.hidden = studioSelectionMode; });
        if (studioButton) studioButton.hidden = !studioSelectionMode;
        studioButton?.addEventListener('click', () => void chooseStudioSong(song));
        row.querySelector('.favorite-row')?.addEventListener('click', () => void toggleFavorite(song));
        row.querySelector('.play-row')?.addEventListener('click', () => { prepareQueueFromView(song); void toggleSong(song); });
        row.querySelector('.more-row')?.addEventListener('click', (event) => {
            const button = event.currentTarget;
            const menu = actionMenu;
            const open = menu.hidden;
            closeSongMenus();
            if (open) {
                menu._home = rowActions;
                const rect = button.getBoundingClientRect();
                document.body.appendChild(menu);
                menu.classList.add('menu-portal');
                menu.hidden = false;
                menu.style.top = `${Math.min(window.innerHeight - 12, rect.bottom + 6)}px`;
                menu.style.left = `${Math.max(12, Math.min(window.innerWidth - menu.offsetWidth - 12, rect.right - menu.offsetWidth))}px`;
                row.classList.add('menu-open');
            }
            else {
                rowActions?.appendChild(menu);
                menu.classList.remove('menu-portal');
                menu.hidden = true;
                row.classList.remove('menu-open');
            }
            button.setAttribute('aria-expanded', String(open));
        });
        actionMenu.addEventListener('click', (event) => { if (event.target.closest('button')) closeSongMenus(); });
        row.querySelector('.rename-row')?.addEventListener('click', () => openRename(song));
        row.querySelector('.folder-row')?.addEventListener('click', () => openCategory(song));
        row.querySelector('.trim-row')?.addEventListener('click', () => void openTrim(song));
        row.querySelector('.quick-trim-row')?.addEventListener('click', () => void openTrim(song));
        row.querySelector('.share-row')?.addEventListener('click', () => void shareSong(song));
        row.querySelector('.download-row')?.addEventListener('click', () => void downloadSong(song));
        row.querySelector('.delete-row')?.addEventListener('click', () => deleteSong(song));
    });
}
async function chooseStudioSong(song) {
    studioSelectionMode = false;
    get('studio-picker-banner').hidden = true;
    renderLibrary();
    document.querySelector('[data-screen="studio"]').click();
    loadSong(song);
    await openTrim(song);
}
async function toggleFavorite(song) {
    song.favorite = !song.favorite;
    try { await dbPut(song); renderLibrary(); cloudSync?.favoriteChanged(song); }
    catch { song.favorite = !song.favorite; toast('Favori durumu kaydedilemedi.', true); }
}
function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character));
}
function loadSong(song) {
    if (activeObjectUrl)
        URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = URL.createObjectURL(song.blob);
    activeSong = song;
    audio.src = activeObjectUrl;
    audio.load();
    player.classList.add('visible');
    document.body.classList.add('has-player');
    playerTitle.textContent = song.name;
    updateMediaSession();
    playerSubtitle.textContent = `${song.source === 'url' ? 'İzinli bağlantı' : song.source === 'x-video' ? 'X videosundan alınan ses' : song.source === 'trim' ? 'Kesit' : 'Dosya'} · cihazda saklanıyor`;
    seek.value = '0';
    // Seçilen ses her zaman baştan başlar (eski sürümlerdeki kayıtlı konumdan devam kaldırıldı).
    updatePlayerUI();
}
const POSITION_KEY = 'sescebi-pos:';
// v36: eski sürümlerden kalan kayıtlı konumları temizle.
try { Object.keys(localStorage).filter((key) => key.startsWith(POSITION_KEY)).forEach((key) => localStorage.removeItem(key)); } catch { /* yok say */ }
function clearPosition(id) {
    try { localStorage.removeItem(POSITION_KEY + id); } catch { /* yok say */ }
}
async function toggleSong(song) {
    if (activeSong?.id !== song.id)
        loadSong(song);
    if (audio.paused) {
        try {
            await audio.play();
        }
        catch {
            toast('Bu ses tarayıcıda oynatılamadı.', true);
        }
    }
    else
        audio.pause();
    renderLibrary();
    updatePlayerUI();
}
function updatePlayerUI() {
    if (!activeSong)
        return;
    playButton.innerHTML = audio.paused ? icons.play : icons.pause;
    playerEqualizer.classList.toggle('is-playing', !audio.paused);
    playButton.setAttribute('aria-label', audio.paused ? 'Oynat' : 'Duraklat');
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : activeSong.duration;
    const current = audio.currentTime || 0;
    seek.max = String(duration || 100);
    seek.value = String(current);
    timeLabel.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    updatePositionState();
    playerSubtitle.textContent = (audio.paused ? 'Duraklatıldı · cihazda saklı' : 'Şimdi çalıyor · cihazda saklı') + queueSuffix();
}
// Klasör ya da "Tümünü dinle" sırası açıkken alt başlığa konum eklenir: · Müzik 2/5
function queueSuffix() {
    if (!queueIds || !activeSong)
        return '';
    const queued = queueSongs();
    const position = queued.findIndex((item) => item.id === activeSong.id);
    return queued.length > 1 && position >= 0 ? ` · ${queueName || 'Liste'} ${position + 1}/${queued.length}` : '';
}
// ---- dışa aktarma: gerçek biçimi bayttan tanı, doğru ad/uzantı/MIME ile indir veya paylaş ----
// Telefondaki müzik çalarlar dosyayı uzantısından ve MIME türünden tanır; yanlış uzantı çalmayı engeller.
const FORMATS = {
    mp3: { ext: 'mp3', mime: 'audio/mpeg' },
    m4a: { ext: 'm4a', mime: 'audio/mp4' },
    wav: { ext: 'wav', mime: 'audio/wav' },
    ogg: { ext: 'ogg', mime: 'audio/ogg' },
    flac: { ext: 'flac', mime: 'audio/flac' },
    aac: { ext: 'aac', mime: 'audio/aac' },
    webm: { ext: 'webm', mime: 'audio/webm' },
};
const FORMAT_BY_TYPE = {
    'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/m4a': 'm4a',
    'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/ogg': 'ogg', 'audio/flac': 'flac',
    'audio/x-flac': 'flac', 'audio/aac': 'aac', 'audio/webm': 'webm',
};
async function detectFormat(blob, declaredType) {
    const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const ascii = (from, to) => String.fromCharCode(...bytes.slice(from, to));
    if (ascii(0, 3) === 'ID3')
        return FORMATS.mp3;
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE')
        return FORMATS.wav;
    if (ascii(0, 4) === 'OggS')
        return FORMATS.ogg;
    if (ascii(0, 4) === 'fLaC')
        return FORMATS.flac;
    if (ascii(4, 8) === 'ftyp')
        return FORMATS.m4a;
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3)
        return FORMATS.webm;
    if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0)
        return FORMATS.aac;
    if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
        return FORMATS.mp3;
    return FORMATS[FORMAT_BY_TYPE[(declaredType || '').toLowerCase()]] || FORMATS.mp3;
}
function safeFileName(name) {
    const cleaned = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 80).trim();
    return cleaned || 'ses';
}
async function exportFile(song) {
    const format = await detectFormat(song.blob, song.type);
    return new File([song.blob], `${safeFileName(song.name)}.${format.ext}`, { type: format.mime });
}
function saveLocationInfo() {
    const ua = navigator.userAgent;
    const note = 'Web uygulamaları dosyanın tam yolunu göremez; bu bilgi tarayıcının varsayılan davranışına göredir. Tarayıcı ayarlarında başka bir indirme klasörü seçtiysen dosya orada olur.';
    if (/android/i.test(ua)) {
        return {
            where: 'telefonunun “İndirilenler” (Download) klasörü',
            steps: [
                'Dosyalar (Google Dosyalar) uygulamasını aç → İndirilenler.',
                'Dosyaya dokunursan telefonun müzik çaları açılır. Çalar listede göstermezse çalardaki “klasörleri tara / yenile” seçeneğini kullan.',
            ],
            note,
        };
    }
    if (isIos) {
        return {
            where: 'Dosyalar uygulaması → İndirilenler',
            steps: [
                'Dosyalar → Bu iPhone’da (veya iCloud Drive) → İndirilenler.',
                'Dosyaya dokununca doğrudan çalar. Başka bir çalara göndermek için Paylaş’a dokunup uygulamayı seç; “Dosyalara Kaydet” ile istediğin klasörü de seçebilirsin.',
            ],
            note: 'iPhone’un Müzik uygulaması web’den inen dosyaları kendiliğinden listesine almaz. ' + note,
        };
    }
    return {
        where: 'tarayıcının indirme klasörü (genellikle İndirilenler / Downloads)',
        steps: ['Tarayıcının indirme listesinden “Klasörde göster” ile aç.'],
        note,
    };
}
function openOverlay(node) {
    closeSongMenus();
    node.hidden = false;
    document.body.classList.add('modal-open');
}
function closeOverlay(node) {
    node.hidden = true;
    if (trimOverlay.hidden && infoOverlay.hidden && renameOverlay.hidden && categoryOverlay.hidden && foldersOverlay.hidden)
        document.body.classList.remove('modal-open');
}
let infoFile = null;
function showSaveInfo(file, pickedName, isAudio = true) {
    const info = saveLocationInfo();
    infoFile = file;
    const steps = pickedName ? [] : info.steps.slice(0, isAudio ? info.steps.length : 1);
    const where = pickedName
        ? `Seçtiğin konuma kaydedildi: <strong>${escapeHtml(pickedName)}</strong>`
        : `İndirme başlatıldı. Dosya şurada olacak: <strong>${escapeHtml(info.where)}</strong>`;
    infoBody.innerHTML = `
    <p class="info-file"><strong>${escapeHtml(file.name)}</strong><span>${formatSize(file.size)}</span></p>
    <p>${where}</p>
    ${steps.length ? `<ul class="info-list">${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ul>` : ''}
    <p class="sheet-sub small">${escapeHtml(info.note)}</p>`;
    infoShareButton.hidden = !canShareFile(file);
    openOverlay(infoOverlay);
}
function closeInfo() {
    closeOverlay(infoOverlay);
    infoFile = null;
}
async function downloadSong(song) {
    let file;
    try {
        file = await exportFile(song);
    }
    catch {
        toast('Dosya hazırlanamadı.', true);
        return;
    }
    await saveFile(file, true);
}
async function saveFile(file, isAudio) {
    // Bilgisayardaki Chromium tarayıcılar kayıt yerini seçtirebilir; telefonlarda bu özellik yoktur.
    if (typeof window.showSaveFilePicker === 'function') {
        try {
            const ext = file.name.split('.').pop();
            const handle = await window.showSaveFilePicker({ suggestedName: file.name, types: [{ description: 'Ses dosyası', accept: { [file.type]: [`.${ext}`] } }] });
            const writable = await handle.createWritable();
            await writable.write(file);
            await writable.close();
            showSaveInfo(file, handle.name, isAudio);
            return;
        }
        catch (error) {
            if (error && error.name === 'AbortError')
                return;
        }
    }
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    showSaveInfo(file, undefined, isAudio);
}
// Chrome, paylaşılabilen dosya türlerini kısıtlar (ör. M4A için audio/mp4 reddedilir, audio/x-m4a kabul edilir).
const SHARE_MIME_ALTERNATES = { m4a: ['audio/x-m4a', 'audio/m4a', 'audio/mp4'], aac: ['audio/aac', 'audio/x-aac', 'audio/mp4'], wav: ['audio/wav', 'audio/x-wav'], mp3: ['audio/mpeg', 'audio/mp3'], ogg: ['audio/ogg'], flac: ['audio/flac', 'audio/x-flac'], webm: ['audio/webm'] };
function shareableFile(file) {
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function')
        return file;
    const ext = file.name.split('.').pop().toLowerCase();
    for (const mime of [file.type, ...(SHARE_MIME_ALTERNATES[ext] || [])]) {
        const candidate = mime === file.type ? file : new File([file], file.name, { type: mime });
        try {
            if (navigator.canShare({ files: [candidate] }))
                return candidate;
        }
        catch { /* sonraki türü dene */ }
    }
    return file;
}
function canShareFile(file) {
    if (typeof navigator.share !== 'function')
        return false;
    if (typeof navigator.canShare !== 'function')
        return true;
    // canShare bazı cihazlarda ses için yanlışlıkla false döner; Android'de yine de paylaşmayı deneriz.
    return navigator.canShare({ files: [shareableFile(file)] }) || /android/i.test(navigator.userAgent);
}
async function shareFile(file, title) {
    if (!canShareFile(file)) {
        toast('Bu cihaz doğrudan dosya paylaşımını desteklemiyor; dosya indiriliyor. İndirdikten sonra Mail veya Drive ile paylaşabilirsin.');
        await saveFile(file, true);
        return;
    }
    if (file.size > 25 * 1024 * 1024)
        toast(`Dosya ${formatSize(file.size)}. Mail eki sınırı genelde 25 MB; büyük dosyada Drive’ı seç.`);
    try {
        await navigator.share({ files: [shareableFile(file)], title });
    }
    catch (error) {
        if (error && error.name === 'AbortError')
            return;
        toast('Mobil paylaşım açılamadı; dosya indiriliyor. İndirdikten sonra Mail veya Drive ile paylaşabilirsin.');
        await saveFile(file, true);
    }
}
async function shareSong(song) {
    let file;
    try {
        file = await exportFile(song);
    }
    catch {
        toast('Dosya hazırlanamadı.', true);
        return;
    }
    if (!canShareFile(file)) {
        toast('Bu cihaz doğrudan dosya paylaşımını desteklemiyor; dosya indiriliyor. İndirdikten sonra Mail veya Drive ile paylaşabilirsin.');
        await downloadSong(song);
        return;
    }
    await shareFile(file, song.name);
}

// ---- kesme ----
// Ses çözülüp (PCM) seçilen aralık 16 bit WAV olarak yeni kayıt yapılır; orijinal isteğe bağlı korunur.
const MAX_TRIM_SECONDS = 15 * 60;
const MIN_CLIP = 0.2;
let trimState = null;
let waveDragging = false;
let waveDragHandle = 'start';
let waveDragViewStart = 0;
function formatClock(value) {
    const tenths = Math.max(0, Math.round(value * 10));
    const minutes = Math.floor(tenths / 600);
    const seconds = (tenths % 600) / 10;
    return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
}
function computePeaks(buffer, buckets) {
    const peaks = new Float32Array(buckets);
    const size = Math.max(1, Math.floor(buffer.length / buckets));
    const stride = Math.max(1, Math.floor(size / 200));
    for (let c = 0; c < Math.min(2, buffer.numberOfChannels); c++) {
        const data = buffer.getChannelData(c);
        for (let b = 0; b < buckets; b++) {
            let max = 0;
            const end = Math.min(buffer.length, b * size + size);
            for (let i = b * size; i < end; i += stride) {
                const value = Math.abs(data[i]);
                if (value > max)
                    max = value;
            }
            if (max > peaks[b])
                peaks[b] = max;
        }
    }
    return peaks;
}
function drawWave() {
    const s = trimState;
    if (!s || !s.peaks || !s.buffer)
        return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(200, Math.round(waveCanvas.clientWidth * dpr));
    const h = Math.round(96 * dpr);
    if (waveCanvas.width !== w)
        waveCanvas.width = w;
    if (waveCanvas.height !== h)
        waveCanvas.height = h;
    const g = waveCanvas.getContext('2d');
    if (!g)
        return;
    g.clearRect(0, 0, w, h);
    const duration = s.buffer.duration;
    const viewDuration = duration / (s.zoom || 1);
    const center = (s.start + s.end) / 2;
    const viewStart = waveDragging ? waveDragViewStart : Math.max(0, Math.min(duration - viewDuration, center - viewDuration / 2));
    const viewEnd = viewStart + viewDuration;
    const x0 = Math.max(0, Math.min(w, ((s.start - viewStart) / viewDuration) * w));
    const x1 = Math.max(0, Math.min(w, ((s.end - viewStart) / viewDuration) * w));
    const n = s.peaks.length;
    const step = Math.max(2, Math.round(3 * dpr));
    const barWidth = Math.max(1, Math.round(2 * dpr));
    for (let x = 0; x < w; x += step) {
        const absoluteTime = viewStart + (x / w) * viewDuration;
        const peak = s.peaks[Math.min(n - 1, Math.max(0, Math.floor((absoluteTime / duration) * n)))];
        const bar = Math.max(2 * dpr, peak * (h - 8 * dpr));
        g.fillStyle = x >= x0 && x <= x1 ? '#d95d39' : '#cdbdab';
        g.fillRect(x, (h - bar) / 2, barWidth, bar);
    }
    if (s.playhead >= 0) {
        g.fillStyle = '#211b18';
        g.fillRect(Math.round(((s.playhead - viewStart) / viewDuration) * w), 0, Math.max(1, Math.round(2 * dpr)), h);
    }
}
function setTrimBusy(busy, text = '') {
    trimStatus.textContent = text;
    trimStatus.hidden = !text;
    trimStart.disabled = busy;
    trimEnd.disabled = busy;
    trimPreviewButton.disabled = busy;
    trimSaveButton.disabled = busy;
    trimOverlay.querySelectorAll('.nudge').forEach((button) => { button.disabled = busy; });
}
function syncTrim(changed) {
    const s = trimState;
    if (!s || !s.buffer)
        return;
    const duration = s.buffer.duration;
    let start = Number(trimStart.value);
    let end = Number(trimEnd.value);
    if (changed === 'start' && start > end - MIN_CLIP)
        start = Math.max(0, end - MIN_CLIP);
    if (changed === 'end' && end < start + MIN_CLIP)
        end = Math.min(duration, start + MIN_CLIP);
    s.start = start;
    s.end = end;
    trimStart.value = String(start);
    trimEnd.value = String(end);
    trimStartLabel.textContent = formatClock(start);
    trimEndLabel.textContent = formatClock(end);
    const length = end - start;
    const bytes = Math.round(length * s.buffer.sampleRate) * Math.min(2, s.buffer.numberOfChannels) * 2 + 44;
    trimSummary.textContent = `Seçili süre: ${formatClock(length)} · yaklaşık ${formatSize(bytes)}`;
    drawWave();
}
async function openTrim(song) {
    if (song.duration > MAX_TRIM_SECONDS) {
        toast(`Kesme en çok ${MAX_TRIM_SECONDS / 60} dakikalık seslerde çalışır (bellek sınırı).`, true);
        return;
    }
    audio.pause();
    closeTrim();
    const state = { song, buffer: null, peaks: null, start: 0, end: song.duration, preview: null, previewUrl: '', playhead: -1, zoom: 1 };
    trimState = state;
    trimName.textContent = song.name;
    trimSummary.textContent = '';
    trimStartLabel.textContent = formatClock(0);
    trimEndLabel.textContent = formatClock(song.duration);
    setTrimBusy(true, 'Ses çözülüyor…');
    openOverlay(trimOverlay);
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    try {
        const buffer = await decodeAudio(ctx, await song.blob.arrayBuffer());
        if (trimState !== state)
            return;
        if (!buffer.length || buffer.duration <= 0)
            throw new Error('empty');
        state.buffer = buffer;
        state.peaks = computePeaks(buffer, 400);
        state.start = 0;
        state.end = buffer.duration;
        trimStart.max = String(buffer.duration);
        trimEnd.max = String(buffer.duration);
        trimStart.value = '0';
        trimEnd.value = String(buffer.duration);
        trimKeep.checked = true;
        get('fade-in').value = '0'; get('fade-out').value = '0'; get('trim-bass').value = '0'; get('trim-treble').value = '0'; get('wave-zoom').value = '1'; state.zoom = 1;
        get('fade-in-value').textContent = '0 sn'; get('fade-out-value').textContent = '0 sn'; get('trim-bass-value').textContent = '0 dB'; get('trim-treble-value').textContent = '0 dB'; get('wave-zoom-value').textContent = '1×';
        setTrimBusy(false);
        trimPreviewButton.textContent = 'Seçimi dinle';
        syncTrim();
    }
    catch {
        if (trimState === state) {
            closeTrim();
            toast('Bu ses tarayıcıda çözülemedi, kesilemiyor.', true);
        }
    }
    finally {
        ctx.close().catch(() => undefined);
    }
}
function closeTrim() {
    const s = trimState;
    if (s && s.preview) {
        s.preview.pause();
        s.preview.removeAttribute('src');
        s.preview.load();
    }
    if (s && s.previewUrl)
        URL.revokeObjectURL(s.previewUrl);
    trimState = null;
    closeOverlay(trimOverlay);
}
function stopTrimPreview() {
    const s = trimState;
    if (!s || !s.preview)
        return;
    s.preview.pause();
    s.playhead = -1;
    trimPreviewButton.textContent = 'Seçimi dinle';
    drawWave();
}
function toggleTrimPreview() {
    const s = trimState;
    if (!s || !s.buffer)
        return;
    if (s.preview && !s.preview.paused) {
        stopTrimPreview();
        return;
    }
    if (!s.preview) {
        s.previewUrl = URL.createObjectURL(s.song.blob);
        const preview = new Audio(s.previewUrl);
        preview.addEventListener('timeupdate', () => {
            s.playhead = preview.currentTime;
            if (preview.currentTime >= s.end)
                stopTrimPreview();
            else
                drawWave();
        });
        preview.addEventListener('ended', stopTrimPreview);
        s.preview = preview;
    }
    const preview = s.preview;
    const begin = () => {
        preview.currentTime = s.start;
        preview.play().then(() => { trimPreviewButton.textContent = 'Durdur'; }).catch(() => toast('Önizleme çalınamadı.', true));
    };
    if (preview.readyState >= 1)
        begin();
    else {
        preview.addEventListener('loadedmetadata', begin, { once: true });
        preview.load();
    }
}
async function saveTrim() {
    const s = trimState;
    if (!s || !s.buffer)
        return;
    stopTrimPreview();
    setTrimBusy(true, 'Kesit hazırlanıyor…');
    try {
        const rate = s.buffer.sampleRate;
        const from = Math.max(0, Math.floor(s.start * rate));
        const to = Math.min(s.buffer.length, Math.ceil(s.end * rate));
        if (to - from < rate * MIN_CLIP * 0.5)
            throw new Error('Seçilen bölüm çok kısa.');
        await new Promise((resolve) => setTimeout(resolve, 30));
        const fadeIn = Number(get('fade-in').value);
        const fadeOut = Number(get('fade-out').value);
        const bass = Number(get('trim-bass').value);
        const treble = Number(get('trim-treble').value);
        const length = to - from;
        let processed = s.buffer;
        let processedFrom = from;
        let processedTo = to;
        if (bass !== 0 || treble !== 0) {
            const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
            if (!OfflineCtx) throw new Error('Bu tarayıcı ses filtrelerini desteklemiyor.');
            const offline = new OfflineCtx(Math.min(2, s.buffer.numberOfChannels), length, rate);
            const clipBuffer = offline.createBuffer(Math.min(2, s.buffer.numberOfChannels), length, rate);
            for (let channel = 0; channel < clipBuffer.numberOfChannels; channel++) clipBuffer.copyToChannel(s.buffer.getChannelData(channel).slice(from, to), channel);
            const source = offline.createBufferSource(); source.buffer = clipBuffer;
            const low = offline.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 180; low.gain.value = bass;
            const high = offline.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 3800; high.gain.value = treble;
            source.connect(low); low.connect(high); high.connect(offline.destination); source.start();
            processed = await offline.startRendering(); processedFrom = 0; processedTo = processed.length;
        }
        const clip = await createSong(encodeWav(processed, processedFrom, processedTo, { fadeIn: Math.min(fadeIn, length / rate / 2), fadeOut: Math.min(fadeOut, length / rate / 2) }), 'kesit', 'trim');
        clip.name = `${s.song.name} (kesit)`;
        if (s.song.category)
            clip.category = s.song.category;
        await dbPut(clip);
        songs = [clip, ...songs];
        const keep = trimKeep.checked;
        const original = s.song;
        closeTrim();
        if (!keep)
            await removeSong(original);
        renderLibrary();
        toast(keep ? 'Kesit yeni kayıt olarak eklendi.' : 'Kesit kaydedildi, orijinal silindi.');
    }
    catch (error) {
        if (trimState === s)
            setTrimBusy(false);
        toast(error instanceof Error ? error.message : 'Kesit kaydedilemedi.', true);
    }
}
get('wave-zoom').addEventListener('input', (event) => { if (trimState) { trimState.zoom = Number(event.target.value) || 1; get('wave-zoom-value').textContent = `${trimState.zoom}×`; drawWave(); } });
get('trim-bass').addEventListener('input', (event) => { get('trim-bass-value').textContent = `${event.target.value} dB`; });
get('trim-treble').addEventListener('input', (event) => { get('trim-treble-value').textContent = `${event.target.value} dB`; });
get('fade-in').addEventListener('input', (event) => { get('fade-in-value').textContent = `${Number(event.target.value).toFixed(1)} sn`; });
get('fade-out').addEventListener('input', (event) => { get('fade-out-value').textContent = `${Number(event.target.value).toFixed(1)} sn`; });
trimStart.addEventListener('input', () => syncTrim('start'));
trimEnd.addEventListener('input', () => syncTrim('end'));
trimOverlay.querySelectorAll('.nudge').forEach((button) => button.addEventListener('click', () => {
    const s = trimState;
    if (!s || !s.buffer)
        return;
    const which = button.dataset.nudge === 'end' ? 'end' : 'start';
    const input = which === 'start' ? trimStart : trimEnd;
    input.value = String(Math.min(s.buffer.duration, Math.max(0, Number(input.value) + Number(button.dataset.delta))));
    syncTrim(which);
}));
waveCanvas.addEventListener('pointerdown', (event) => {
    waveDragging = true;
    waveCanvas.setPointerCapture?.(event.pointerId);
    const s = trimState;
    if (!s || !s.buffer)
        return;
    const rect = waveCanvas.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const viewDuration = s.buffer.duration / (s.zoom || 1);
    const viewStart = Math.max(0, Math.min(s.buffer.duration - viewDuration, (s.start + s.end) / 2 - viewDuration / 2));
    const time = viewStart + fraction * viewDuration;
    waveDragHandle = Math.abs(time - s.start) <= Math.abs(time - s.end) ? 'start' : 'end';
    waveDragViewStart = viewStart;
    (waveDragHandle === 'start' ? trimStart : trimEnd).value = String(time);
    syncTrim(waveDragHandle);
});
waveCanvas.addEventListener('pointermove', (event) => {
    if (!waveDragging || !trimState?.buffer) return;
    const rect = waveCanvas.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const viewDuration = trimState.buffer.duration / (trimState.zoom || 1);
    const time = waveDragViewStart + fraction * viewDuration;
    (waveDragHandle === 'start' ? trimStart : trimEnd).value = String(time); syncTrim(waveDragHandle);
});
waveCanvas.addEventListener('pointerup', () => { waveDragging = false; });
waveCanvas.addEventListener('pointercancel', () => { waveDragging = false; });
waveCanvas.addEventListener('lostpointercapture', () => { waveDragging = false; });
trimPreviewButton.addEventListener('click', toggleTrimPreview);
trimSaveButton.addEventListener('click', () => void saveTrim());
get('trim-close').addEventListener('click', closeTrim);
get('info-close').addEventListener('click', closeInfo);
get('info-ok').addEventListener('click', closeInfo);
infoShareButton.addEventListener('click', () => { if (infoFile)
    void shareFile(infoFile, infoFile.name); });
trimOverlay.addEventListener('click', (event) => { if (event.target === trimOverlay)
    closeTrim(); });
infoOverlay.addEventListener('click', (event) => { if (event.target === infoOverlay)
    closeInfo(); });
document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape')
        return;
    if (!renameOverlay.hidden)
        closeRename();
    else if (!infoOverlay.hidden)
        closeInfo();
    else if (!trimOverlay.hidden)
        closeTrim();
});
window.addEventListener('resize', drawWave);
async function deleteSong(song) {
    if (!window.confirm(`“${song.name}” arşivden silinsin mi?`))
        return;
    await removeSong(song);
}
async function removeSong(song) {
    try {
        await dbDelete(song.id);
        clearPosition(song.id);
        songs = songs.filter((item) => item.id !== song.id);
        if (activeSong?.id === song.id) {
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
            if (activeObjectUrl) {
                URL.revokeObjectURL(activeObjectUrl);
                activeObjectUrl = '';
            }
            activeSong = null;
            listenAll = false;
            player.classList.remove('visible');
            document.body.classList.remove('has-player');
        }
        renderLibrary();
        toast('Ses arşivden silindi.');
    }
    catch {
        toast('Ses silinemedi; cihaz depolamasını kontrol et.', true);
    }
}
function setSelectedFile(file) {
    selectedFile = file;
    fileName.textContent = file ? `${file.name} · ${formatSize(file.size)}` : 'Henüz dosya seçilmedi';
    updateAddButton();
}
fileInput.addEventListener('change', () => setSelectedFile(fileInput.files?.[0] || null));
const dropZone = document.querySelector('.file-drop');
if (dropZone) {
    ['dragenter', 'dragover'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.add('dragging'); }));
    ['dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, () => dropZone.classList.remove('dragging')));
    dropZone.addEventListener('drop', (event) => {
        event.preventDefault();
        const file = event.dataTransfer?.files?.[0];
        if (file) { switchTab('file'); setSelectedFile(file); }
    });
}
// Sayfaya yanlışlıkla bırakılan dosya tarayıcıyı başka sayfaya götürmesin.
['dragover', 'drop'].forEach((name) => window.addEventListener(name, (event) => { if (!event.target.closest?.('.file-drop')) event.preventDefault(); }));
consent.addEventListener('change', updateAddButton);
urlInput.addEventListener('input', updateAddButton);
addButton.addEventListener('click', () => void addSelectedAudio());
document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab)));
playButton.addEventListener('click', async () => {
    if (!activeSong)
        return;
    if (audio.paused) {
        try {
            await audio.play();
        }
        catch {
            toast('Bu ses tarayıcıda oynatılamadı.', true);
        }
    }
    else
        audio.pause();
    updatePlayerUI();
    renderLibrary();
});
get('back-button').addEventListener('click', () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
get('forward-button').addEventListener('click', () => { audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 10); });
seek.addEventListener('input', () => { audio.currentTime = Number(seek.value); updatePlayerUI(); });
audio.addEventListener('timeupdate', updatePlayerUI);
audio.addEventListener('loadedmetadata', updatePlayerUI);
audio.addEventListener('play', () => { startListeningSession(); updatePlayerUI(); renderLibrary(); });
audio.addEventListener('pause', () => { flushListeningSession(true); updatePlayerUI(); renderLibrary(); });
audio.addEventListener('ended', () => { if (activeSong) clearPosition(activeSong.id); flushListeningSession(true); updatePlayerUI(); renderLibrary(); void handleEnded(); });
// ---- v15: ad değiştirme ----
const renameOverlay = get('rename-overlay');
const renameInput = get('rename-input');
let renameTarget = null;
function openRename(song) {
    renameTarget = song;
    renameInput.value = song.name;
    openOverlay(renameOverlay);
    renameInput.focus();
    renameInput.select();
}
function closeRename() {
    renameTarget = null;
    closeOverlay(renameOverlay);
}
async function saveRename() {
    const song = renameTarget;
    if (!song)
        return;
    const name = renameInput.value.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!name) {
        toast('Ad boş olamaz.', true);
        return;
    }
    const previous = song.name;
    try {
        song.name = name;
        await dbPut(song);
    }
    catch {
        song.name = previous;
        toast('Ad kaydedilemedi; cihaz depolamasını kontrol et.', true);
        return;
    }
    if (activeSong?.id === song.id) {
        playerTitle.textContent = name;
        updateMediaSession();
    }
    renderLibrary();
    closeRename();
    toast('Ad değiştirildi.');
}
get('rename-save').addEventListener('click', () => void saveRename());
get('rename-close').addEventListener('click', closeRename);
renameInput.addEventListener('keydown', (event) => { if (event.key === 'Enter')
    void saveRename(); });
renameOverlay.addEventListener('click', (event) => { if (event.target === renameOverlay)
    closeRename(); });

// ---- v35: klasörler (şiir / müzik / hayata dair), Tümünü dinle, bağlantı temizleme ----
function categoryLabel(id) {
    return CATEGORIES.find((item) => item.id === id)?.label || '';
}
function folderName(id) {
    return id === 'all' ? 'Liste' : id === 'none' ? 'Klasörsüz' : categoryLabel(id) || 'Liste';
}
function inFolder(song) {
    if (categoryFilter === 'all')
        return true;
    const own = CATEGORIES.some((item) => item.id === song.category) ? song.category : '';
    return categoryFilter === 'none' ? !own : own === categoryFilter;
}
function renderFolderBar() {
    folderBar.hidden = songs.length === 0;
    if (!songs.length)
        return;
    const counts = { all: songs.length, none: 0 };
    CATEGORIES.forEach((item) => { counts[item.id] = 0; });
    songs.forEach((song) => { if (counts[song.category] !== undefined && song.category !== 'all' && song.category !== 'none')
        counts[song.category]++;
    else
        counts.none++; });
    const items = [{ id: 'all', label: 'Tümü' }, ...CATEGORIES];
    if ((counts.none > 0 && counts.none < songs.length) || categoryFilter === 'none')
        items.push({ id: 'none', label: 'Klasörsüz' });
    folderBar.innerHTML = items.map((item) => `<button class="chip" type="button" data-folder="${escapeHtml(item.id)}" aria-pressed="${categoryFilter === item.id}">${escapeHtml(item.label)}<small>${counts[item.id]}</small></button>`).join('') + `<button class="chip" type="button" data-manage-folders aria-label="Klasörleri düzenle">＋ Klasör</button>`;
}
function renderAddFolder() {
    const items = [{ id: '', label: 'Klasörsüz' }, ...CATEGORIES];
    addFolder.innerHTML = items.map((item) => `<button class="chip" type="button" data-add-folder="${escapeHtml(item.id)}" aria-pressed="${addCategory === item.id}">${escapeHtml(item.label)}</button>`).join('') + `<button class="chip" type="button" data-manage-folders aria-label="Klasörleri düzenle">＋ Klasör</button>`;
}
folderBar.addEventListener('click', (event) => {
    if (event.target.closest('[data-manage-folders]')) {
        openFolders();
        return;
    }
    const button = event.target.closest('[data-folder]');
    if (!button)
        return;
    const id = button.dataset.folder;
    categoryFilter = categoryFilter === id ? 'all' : id;
    addCategory = CATEGORIES.some((item) => item.id === categoryFilter) ? categoryFilter : '';
    renderAddFolder();
    renderLibrary();
});
addFolder.addEventListener('click', (event) => {
    if (event.target.closest('[data-manage-folders]')) {
        openFolders();
        return;
    }
    const button = event.target.closest('[data-add-folder]');
    if (!button)
        return;
    addCategory = button.dataset.addFolder;
    renderAddFolder();
});
renderAddFolder();

function folderDirFor(label, exceptId) {
    const base = label.toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'klasor';
    let dir = base;
    let n = 2;
    while (CATEGORIES.some((item) => item.dir === dir && item.id !== exceptId))
        dir = `${base}-${n++}`;
    return dir;
}
function folderNameTaken(label, exceptId) {
    return CATEGORIES.some((item) => item.id !== exceptId && item.label.toLocaleLowerCase('tr') === label.toLocaleLowerCase('tr'));
}
function refreshFolderViews() {
    saveFolders();
    renderAddFolder();
    renderFoldersList();
    renderLibrary();
}
function renderFoldersList() {
    foldersList.innerHTML = CATEGORIES.length
        ? CATEGORIES.map((item) => `<div class="folder-manage-row" data-id="${escapeHtml(item.id)}"><span>${icons.folder}<strong>${escapeHtml(item.label)}</strong></span><button class="ghost-button" type="button" data-folder-rename>Adı değiştir</button><button class="ghost-button cloud-danger-btn" type="button" data-folder-delete>Sil</button></div>`).join('')
        : '<p class="sheet-sub">Henüz klasör yok. Yukarıdan ekleyebilirsin.</p>';
}
function openFolders() {
    renderFoldersList();
    folderNameInput.value = '';
    openOverlay(foldersOverlay);
}
function closeFolders() {
    closeOverlay(foldersOverlay);
}
function addFolderFromInput() {
    const label = folderNameInput.value.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!label) {
        toast('Klasör adı yaz.', true);
        return;
    }
    if (folderNameTaken(label)) {
        toast('Bu adda bir klasör zaten var.', true);
        return;
    }
    if (CATEGORIES.length >= 20) {
        toast('En fazla 20 klasör ekleyebilirsin.', true);
        return;
    }
    CATEGORIES.push({ id: `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, label, dir: folderDirFor(label) });
    folderNameInput.value = '';
    refreshFolderViews();
    toast(`“${label}” klasörü eklendi.`);
}
async function renameFolder(id) {
    const folder = CATEGORIES.find((item) => item.id === id);
    if (!folder)
        return;
    const label = (window.prompt('Klasörün yeni adı:', folder.label) || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!label || label === folder.label)
        return;
    if (folderNameTaken(label, id)) {
        toast('Bu adda bir klasör zaten var.', true);
        return;
    }
    folder.label = label;
    folder.dir = folderDirFor(label, id);
    refreshFolderViews();
    toast('Klasörün adı değişti.');
}
async function deleteFolder(id) {
    const folder = CATEGORIES.find((item) => item.id === id);
    if (!folder)
        return;
    const inside = songs.filter((song) => song.category === id);
    if (!window.confirm(`“${folder.label}” klasörü silinsin mi?${inside.length ? `\n\nİçindeki ${inside.length} ses silinmez, klasörsüz kalır.` : ''}`))
        return;
    try {
        for (const song of inside) {
            delete song.category;
            await dbPut(song);
        }
    }
    catch {
        toast('Klasör silinirken bir sorun oluştu; cihaz depolamasını kontrol et.', true);
        return;
    }
    CATEGORIES.splice(CATEGORIES.findIndex((item) => item.id === id), 1);
    if (categoryFilter === id)
        categoryFilter = 'all';
    if (addCategory === id)
        addCategory = '';
    refreshFolderViews();
    toast('Klasör silindi.');
}
get('folder-add-button').addEventListener('click', addFolderFromInput);
folderNameInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') {
    event.preventDefault();
    addFolderFromInput();
} });
foldersList.addEventListener('click', (event) => {
    const row = event.target.closest('.folder-manage-row');
    if (!row)
        return;
    if (event.target.closest('[data-folder-rename]'))
        void renameFolder(row.dataset.id);
    else if (event.target.closest('[data-folder-delete]'))
        void deleteFolder(row.dataset.id);
});
get('folders-close').addEventListener('click', closeFolders);
foldersOverlay.addEventListener('click', (event) => { if (event.target === foldersOverlay)
    closeFolders(); });
function openCategory(song) {
    renderLibrary(); // açık ⋯ menüsünü kapatır; pencerenin üstünde kalmasın
    categoryTarget = song;
    get('category-song').textContent = song.name;
    const current = CATEGORIES.some((item) => item.id === song.category) ? song.category : '';
    categoryOptions.innerHTML = [...CATEGORIES, { id: '', label: 'Klasörsüz (klasörden çıkar)' }].map((item) => `<button class="category-option${item.id === current ? ' is-current' : ''}" type="button" data-set-category="${escapeHtml(item.id)}" aria-pressed="${item.id === current}">${icons.folder}<span>${escapeHtml(item.label)}</span></button>`).join('') + `<button class="category-option" type="button" data-manage-folders>${icons.plus}<span>Klasörleri düzenle / yeni klasör</span></button>`;
    openOverlay(categoryOverlay);
}
function closeCategory() {
    categoryTarget = null;
    closeOverlay(categoryOverlay);
}
async function applyCategory(id) {
    const song = categoryTarget;
    if (!song)
        return;
    const previous = song.category;
    if ((previous || '') === id) {
        closeCategory();
        return;
    }
    try {
        if (id)
            song.category = id;
        else
            delete song.category;
        await dbPut(song);
    }
    catch {
        if (previous)
            song.category = previous;
        else
            delete song.category;
        toast('Klasör kaydedilemedi; cihaz depolamasını kontrol et.', true);
        return;
    }
    closeCategory();
    renderLibrary();
    toast(id ? `“${song.name}” ${categoryLabel(id)} klasörüne taşındı.` : `“${song.name}” klasörden çıkarıldı.`);
}
categoryOptions.addEventListener('click', (event) => {
    if (event.target.closest('[data-manage-folders]')) {
        closeCategory();
        openFolders();
        return;
    }
    const button = event.target.closest('[data-set-category]');
    if (button)
        void applyCategory(button.dataset.setCategory);
});
get('category-close').addEventListener('click', closeCategory);
categoryOverlay.addEventListener('click', (event) => { if (event.target === categoryOverlay)
    closeCategory(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !categoryOverlay.hidden)
    closeCategory(); });

// Klasörden bir kayda dokunulunca sıra o klasör olur; "Tümü" görünümünde eski davranış (tüm arşiv) sürer.
function prepareQueueFromView(song) {
    if (activeSong?.id === song.id)
        return; // aynı kaydı duraklat/devam ettir: sıra değişmez
    queueIds = categoryFilter === 'all' ? null : lastVisibleSongs.map((item) => item.id);
    queueName = folderName(categoryFilter);
    listenAll = false;
}
async function listenAllVisible() {
    const list = lastVisibleSongs;
    if (!list.length)
        return;
    queueIds = list.map((item) => item.id);
    queueName = folderName(categoryFilter);
    listenAll = true;
    const first = playMode === 'shuffle' ? list[Math.floor(Math.random() * list.length)] : list[0];
    toast(`${list.length} kayıt sırayla çalınacak.`);
    await playSong(first);
}
listenAllButton.addEventListener('click', () => void listenAllVisible());

// Bağlantı alanlarında tek dokunuşla temizleme
function syncClearButtons() {
    urlClear.hidden = !urlInput.value;
    xVideoClear.hidden = !xVideoUrl.value;
}
function clearField(input, after) {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (after)
        after();
    input.focus();
}
function clearXField(focus = true) {
    xVideoUrl.value = '';
    xVideoResults.replaceChildren();
    xVideoVariants = [];
    setXVideoStatus('');
    syncClearButtons();
    if (focus)
        xVideoUrl.focus();
}
urlInput.addEventListener('input', syncClearButtons);
xVideoUrl.addEventListener('input', syncClearButtons);
urlClear.addEventListener('click', () => clearField(urlInput));
xVideoClear.addEventListener('click', () => clearXField());
// Alana dokununca eski bağlantı tümüyle seçilir: yeni bağlantıyı yapıştırmak eskisini tek hamlede değiştirir.
for (const input of [urlInput, xVideoUrl])
    input.addEventListener('focus', () => window.setTimeout(() => input.select(), 0));
// Yeni bağlantı yapıştırıldığında önceki aramanın sonuçları da kalkar.
xVideoUrl.addEventListener('paste', () => { xVideoResults.replaceChildren(); xVideoVariants = []; setXVideoStatus(''); });
syncClearButtons();

// ---- v15: sıradaki ses, tekrar, kilit ekranı kontrolleri ----
const prevButton = get('prev-button');
const nextButton = get('next-button');
const modeButton = get('mode-button');
const PLAY_MODES = [
    { id: 'once', label: 'Tek seferlik' },
    { id: 'seq', label: 'Sırayla çal' },
    { id: 'loop', label: 'Hepsini tekrarla' },
    { id: 'one', label: 'Bunu tekrarla' },
    { id: 'shuffle', label: 'Karıştır' },
];
let playMode = 'seq';
try {
    const saved = window.localStorage.getItem('sescebi-mode');
    if (PLAY_MODES.some((mode) => mode.id === saved))
        playMode = saved;
}
catch { /* depolama kapalı olabilir; varsayılan düzen kullanılır */ }
function refreshModeButton() {
    const mode = PLAY_MODES.find((item) => item.id === playMode) || PLAY_MODES[1];
    modeButton.textContent = mode.label;
    modeButton.setAttribute('aria-label', `Çalma düzeni: ${mode.label}. Değiştirmek için dokun.`);
}
function neighborSong(step, wrap) {
    const list = queueSongs();
    const index = list.findIndex((song) => song.id === activeSong?.id);
    if (index < 0)
        return null;
    let target = index + step;
    if (target < 0 || target >= list.length) {
        if (!wrap)
            return null;
        target = (target + list.length) % list.length;
    }
    return list[target] || null;
}
// Çalma sırası: klasör/“Tümünü dinle” başlatıldıysa o liste, değilse tüm arşiv (eski davranış).
function queueSongs() {
    if (queueIds) {
        const byId = new Map(songs.map((song) => [song.id, song]));
        const list = queueIds.map((id) => byId.get(id)).filter(Boolean);
        if (list.length && (!activeSong || list.some((song) => song.id === activeSong.id)))
            return list;
    }
    return songs;
}
function randomOther(list) {
    const others = list.filter((song) => song.id !== activeSong?.id);
    return others[Math.floor(Math.random() * others.length)] || null;
}
async function playSong(song) {
    loadSong(song);
    try {
        await audio.play();
    }
    catch {
        toast('Bu ses tarayıcıda oynatılamadı.', true);
    }
    renderLibrary();
    updatePlayerUI();
}
async function handleEnded() {
    // "Tümünü dinle" sırasında tek seferlik / tek tekrar düzenleri sırayı durdurmasın (kayıtlı çalma düzeni değişmez).
    const mode = listenAll && (playMode === 'once' || playMode === 'one') ? 'seq' : playMode;
    if (mode === 'once')
        return;
    if (mode === 'one') {
        audio.currentTime = 0;
        await audio.play().catch(() => undefined);
        return;
    }
    const next = mode === 'shuffle' ? randomOther(queueSongs()) : neighborSong(1, mode === 'loop');
    if (next)
        await playSong(next);
    else
        listenAll = false;
}
modeButton.addEventListener('click', () => {
    const index = PLAY_MODES.findIndex((mode) => mode.id === playMode);
    playMode = PLAY_MODES[(index + 1) % PLAY_MODES.length].id;
    try {
        window.localStorage.setItem('sescebi-mode', playMode);
    }
    catch { /* kaydedilemese de düzen bu oturumda geçerli */ }
    refreshModeButton();
});
nextButton.addEventListener('click', () => {
    if (!activeSong) {
        toast('Önce bir ses çal.', true);
        return;
    }
    const next = playMode === 'shuffle' ? randomOther(queueSongs()) : neighborSong(1, playMode === 'loop');
    if (next)
        void playSong(next);
    else
        toast('Listenin sonundasın.');
});
prevButton.addEventListener('click', () => {
    if (!activeSong) {
        toast('Önce bir ses çal.', true);
        return;
    }
    const previous = audio.currentTime > 3 ? null : neighborSong(-1, playMode === 'loop');
    if (previous)
        void playSong(previous);
    else
        audio.currentTime = 0;
});
refreshModeButton();
get('stat-top-track').addEventListener('click', jumpToTopTrack);
get('library-search').addEventListener('input', (event) => { searchQuery = event.target.value; renderLibrary(); });
get('library-sort').addEventListener('change', (event) => { sortMode = event.target.value; renderLibrary(); });
get('favorites-filter').addEventListener('click', (event) => { favoritesOnly = !favoritesOnly; event.currentTarget.setAttribute('aria-pressed', String(favoritesOnly)); event.currentTarget.classList.toggle('active', favoritesOnly); renderLibrary(); });
// Ses seviyesi: kartın üstünde kaydırıcı ve sessize alma. iPhone/iPad tarayıcıları ses seviyesini yalnızca fiziksel tuşlardan değiştirir, orada gizlenir.
const volumeSlider = get('volume-slider');
const muteButton = get('mute-button');
const VOLUME_KEY = 'sescebi-volume';
let lastVolume = 1;
function paintVolume() {
    const level = audio.muted ? 0 : audio.volume;
    volumeSlider.value = String(Math.round(level * 100));
    get('volume-value').textContent = `${Math.round(level * 100)}%`;
    get('vol-wave').style.display = level === 0 ? 'none' : '';
    muteButton.setAttribute('aria-pressed', String(level === 0));
}
if (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    get('player-volume').hidden = true;
try {
    const saved = Number(localStorage.getItem(VOLUME_KEY));
    if (localStorage.getItem(VOLUME_KEY) !== null && saved >= 0 && saved <= 1)
        audio.volume = saved;
}
catch { /* kayıtlı seviye yoksa tam ses */ }
if (audio.volume > 0)
    lastVolume = audio.volume;
volumeSlider.addEventListener('input', () => {
    const level = Math.max(0, Math.min(1, Number(volumeSlider.value) / 100));
    audio.muted = false;
    audio.volume = level;
    if (level > 0)
        lastVolume = level;
    try {
        localStorage.setItem(VOLUME_KEY, String(level));
    }
    catch { /* kaydedilemese de bu oturumda geçerli */ }
    paintVolume();
});
muteButton.addEventListener('click', () => {
    if (audio.muted || audio.volume === 0) {
        audio.muted = false;
        audio.volume = lastVolume || 1;
    }
    else {
        lastVolume = audio.volume;
        audio.muted = true;
    }
    paintVolume();
});
paintVolume();
get('playback-speed').addEventListener('change', (event) => { audio.playbackRate = Number(event.target.value) || 1; updatePositionState(); });
get('sleep-button').addEventListener('click', () => {
    const answer = window.prompt('Uyku zamanlayıcısı kaç dakika olsun? (0 = iptal)', '30');
    if (answer === null) return;
    const minutes = Number(answer);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 240) { toast('0–240 arasında dakika gir.', true); return; }
    if (sleepTimerId) window.clearTimeout(sleepTimerId);
    sleepTimerId = 0;
    if (minutes === 0) { toast('Uyku zamanlayıcısı iptal edildi.'); return; }
    sleepTimerId = window.setTimeout(() => { audio.pause(); sleepTimerId = 0; toast('Uyku zamanlayıcısı sesi durdurdu.'); }, minutes * 60000);
    toast(`Ses ${minutes} dakika sonra duracak.`);
});
const screenTitles = { library: 'Ses arşivi', home: 'Ses ekle', studio: 'Stüdyo' };
function switchScreen(target) {
  if (target !== 'library' && studioSelectionMode) { studioSelectionMode = false; get('studio-picker-banner').hidden = true; renderLibrary(); }
  document.querySelectorAll('.screen-view').forEach((view) => view.classList.toggle('active', view.id === `screen-${target}`));
  document.querySelectorAll('[data-screen]').forEach((item) => item.classList.toggle('active', item.dataset.screen === target));
  const titleEl = get('topbar-title');
  if (titleEl) titleEl.textContent = screenTitles[target] || 'Ses arşivi';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('[data-screen]').forEach((button) => button.addEventListener('click', () => switchScreen(button.dataset.screen)));

const profileOverlay = get('profile-overlay');
const legalOverlay = get('legal-overlay');
const openProfile = () => { if (profileOverlay) { profileOverlay.hidden = false; document.body.classList.add('modal-open'); } };
const closeProfile = () => { if (profileOverlay) { profileOverlay.hidden = true; document.body.classList.remove('modal-open'); } };
const openLegal = () => { if (legalOverlay) { legalOverlay.hidden = false; document.body.classList.add('modal-open'); } };
const closeLegal = () => { if (legalOverlay) { legalOverlay.hidden = true; document.body.classList.remove('modal-open'); } };

get('open-profile-sheet')?.addEventListener('click', openProfile);
get('profile-close')?.addEventListener('click', closeProfile);
profileOverlay?.addEventListener('click', (e) => { if (e.target === profileOverlay) closeProfile(); });

const guideOverlay = get('guide-overlay');
const closeGuide = () => { if (guideOverlay) { guideOverlay.hidden = true; document.body.classList.remove('modal-open'); } };
get('open-guide-sheet')?.addEventListener('click', () => { if (guideOverlay) { guideOverlay.hidden = false; document.body.classList.add('modal-open'); } });
get('guide-close')?.addEventListener('click', closeGuide);
guideOverlay?.addEventListener('click', (e) => { if (e.target === guideOverlay) closeGuide(); });
get('open-legal-sheet')?.addEventListener('click', openLegal);
get('legal-close')?.addEventListener('click', closeLegal);
legalOverlay?.addEventListener('click', (e) => { if (e.target === legalOverlay) closeLegal(); });
get('studio-open-library').addEventListener('click', () => {
  studioSelectionMode = true;
  get('studio-picker-banner').hidden = false;
  renderLibrary();
  document.querySelector('[data-screen="library"]').click();
});
window.addEventListener('pagehide', () => flushListeningSession(true));
window.setInterval(() => { if (!audio.paused) flushListeningSession(false); }, 5000);
get('studio-picker-cancel').addEventListener('click', () => {
  studioSelectionMode = false;
  get('studio-picker-banner').hidden = true;
  renderLibrary();
  document.querySelector('[data-screen="studio"]').click();
});

const themeToggle = get('theme-toggle');
try { const saved = localStorage.getItem('sescebi-theme'); if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved; } catch {}
themeToggle.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('sescebi-theme', next); } catch {}
});
function updateMediaSession() {
    if (!('mediaSession' in navigator) || !activeSong)
        return;
    try {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: activeSong.name,
            artist: 'Ses Cebi',
            album: 'Cebimdeki sesler',
            artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
        });
    }
    catch { /* meta veri desteklenmiyorsa çalma etkilenmez */ }
}
function updatePositionState() {
    if (!('mediaSession' in navigator))
        return;
    try {
        navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
        if (navigator.mediaSession.setPositionState && Number.isFinite(audio.duration) && audio.duration > 0) {
            navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: Math.min(audio.currentTime, audio.duration) });
        }
    }
    catch { /* konum bilgisi isteğe bağlıdır */ }
}
if ('mediaSession' in navigator) {
    const handlers = {
        play: () => { void audio.play().catch(() => undefined); },
        pause: () => audio.pause(),
        seekbackward: () => { audio.currentTime = Math.max(0, audio.currentTime - 10); },
        seekforward: () => { audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 10); },
        previoustrack: () => prevButton.click(),
        nexttrack: () => nextButton.click(),
        seekto: (details) => { if (typeof details.seekTime === 'number')
            audio.currentTime = details.seekTime; },
    };
    for (const [action, handler] of Object.entries(handlers)) {
        try {
            navigator.mediaSession.setActionHandler(action, handler);
        }
        catch { /* bu eylem tarayıcıda yok */ }
    }
}

// ---- v15: yedekleme ve geri yükleme (sıkıştırmasız standart .zip) ----
const backupButton = get('backup-button');
const restoreButton = get('restore-button');
const restoreInput = get('restore-input');
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++)
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();
function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++)
        c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
async function buildZip(entries) {
    const encoder = new TextEncoder();
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const entry of entries) {
        const name = encoder.encode(entry.name);
        const size = entry.blob.size;
        const crc = crc32(new Uint8Array(await entry.blob.arrayBuffer()));
        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true);
        local.setUint16(6, 0x0800, true);
        local.setUint16(10, dosTime, true);
        local.setUint16(12, dosDate, true);
        local.setUint32(14, crc, true);
        local.setUint32(18, size, true);
        local.setUint32(22, size, true);
        local.setUint16(26, name.length, true);
        parts.push(local.buffer, name, entry.blob);
        const head = new DataView(new ArrayBuffer(46));
        head.setUint32(0, 0x02014b50, true);
        head.setUint16(4, 20, true);
        head.setUint16(6, 20, true);
        head.setUint16(8, 0x0800, true);
        head.setUint16(12, dosTime, true);
        head.setUint16(14, dosDate, true);
        head.setUint32(16, crc, true);
        head.setUint32(20, size, true);
        head.setUint32(24, size, true);
        head.setUint16(28, name.length, true);
        head.setUint32(42, offset, true);
        central.push(head.buffer, name);
        offset += 30 + name.length + size;
        if (offset > 0xfff00000)
            throw new Error('Yedek 4 GB sınırını aşıyor; bazı sesleri silip tekrar dene.');
    }
    let centralSize = 0;
    for (const part of central)
        centralSize += part.byteLength;
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}
async function readZipEntries(file) {
    const tailSize = Math.min(file.size, 65557);
    if (tailSize < 22)
        throw new Error('Bu bir zip dosyası gibi görünmüyor.');
    const tail = new DataView(await file.slice(file.size - tailSize).arrayBuffer());
    let end = -1;
    for (let i = tailSize - 22; i >= 0; i--) {
        if (tail.getUint32(i, true) === 0x06054b50) {
            end = i;
            break;
        }
    }
    if (end < 0)
        throw new Error('Bu bir zip dosyası gibi görünmüyor.');
    const count = tail.getUint16(end + 10, true);
    const centralSize = tail.getUint32(end + 12, true);
    const centralOffset = tail.getUint32(end + 16, true);
    if (count === 0xffff || centralOffset === 0xffffffff)
        throw new Error('Bu zip biçimi desteklenmiyor.');
    const central = new DataView(await file.slice(centralOffset, centralOffset + centralSize).arrayBuffer());
    const decoder = new TextDecoder();
    const entries = [];
    let p = 0;
    for (let i = 0; i < count; i++) {
        if (p + 46 > central.byteLength || central.getUint32(p, true) !== 0x02014b50)
            throw new Error('Zip dosyası bozuk.');
        const nameLength = central.getUint16(p + 28, true);
        const extraLength = central.getUint16(p + 30, true);
        const commentLength = central.getUint16(p + 32, true);
        entries.push({
            name: decoder.decode(new Uint8Array(central.buffer, p + 46, nameLength)),
            method: central.getUint16(p + 10, true),
            size: central.getUint32(p + 20, true),
            offset: central.getUint32(p + 42, true),
        });
        p += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}
async function zipEntryBlob(file, entry) {
    if (entry.method !== 0)
        throw new Error('Sıkıştırılmış zip desteklenmiyor; yalnızca Ses Cebi’nin kendi yedeği yüklenebilir.');
    const header = new DataView(await file.slice(entry.offset, entry.offset + 30).arrayBuffer());
    if (header.byteLength < 30 || header.getUint32(0, true) !== 0x04034b50)
        throw new Error('Zip dosyası bozuk.');
    const start = entry.offset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
    if (start + entry.size > file.size)
        throw new Error('Zip dosyası eksik veya bozuk.');
    return file.slice(start, start + entry.size);
}
function setBackupBusy(busy, button, text) {
    backupButton.disabled = busy;
    restoreButton.disabled = busy;
    backupButton.querySelector('span').textContent = busy && button === 'backup' ? text : 'Yedek al';
    restoreButton.querySelector('span').textContent = busy && button === 'restore' ? text : 'Yedekten yükle';
}
async function createBackup() {
    if (!songs.length) {
        toast('Yedeklenecek kayıt yok.', true);
        return;
    }
    setBackupBusy(true, 'backup', 'Hazırlanıyor…');
    try {
        const entries = [];
        const manifest = { app: 'sescebi', version: 1, created: new Date().toISOString(), folders: CATEGORIES.map(({ id, label, dir }) => ({ id, label, dir })), songs: [] };
        for (let i = 0; i < songs.length; i++) {
            const song = songs[i];
            const format = await detectFormat(song.blob, song.type);
            // Klasörlü sesler ZIP içinde de kendi klasöründe durur: sesler/siir/001-ad.mp3
            const folderDir = CATEGORIES.find((item) => item.id === song.category)?.dir;
            const file = `sesler/${folderDir ? `${folderDir}/` : ''}${String(i + 1).padStart(3, '0')}-${safeFileName(song.name)}.${format.ext}`;
            entries.push({ name: file, blob: song.blob });
            manifest.songs.push({ id: song.id, name: song.name, duration: song.duration, source: song.source, createdAt: song.createdAt, favorite: !!song.favorite, category: folderDir ? song.category : '', type: format.mime, file });
        }
        entries.push({ name: 'sescebi.json', blob: new Blob([JSON.stringify(manifest, null, 1)], { type: 'application/json' }) });
        const zip = await buildZip(entries);
        const day = new Date().toISOString().slice(0, 10);
        await saveFile(new File([zip], `ses-cebi-yedek-${day}.zip`, { type: 'application/zip' }), false);
    }
    catch (error) {
        toast(error instanceof Error ? error.message : 'Yedek hazırlanamadı.', true);
    }
    finally {
        setBackupBusy(false);
    }
}
async function restoreBackup(file) {
    setBackupBusy(true, 'restore', 'Yükleniyor…');
    try {
        const entries = await readZipEntries(file);
        const manifestEntry = entries.find((entry) => entry.name === 'sescebi.json');
        if (!manifestEntry)
            throw new Error('Bu dosya bir Ses Cebi yedeği değil.');
        const manifest = JSON.parse(await (await zipEntryBlob(file, manifestEntry)).text());
        if (!manifest || manifest.app !== 'sescebi' || !Array.isArray(manifest.songs))
            throw new Error('Bu dosya bir Ses Cebi yedeği değil.');
        // Yedekteki klasörler cihazda yoksa eklenir (aynı adlı klasör varsa onun kimliği kullanılır).
        const folderMap = new Map();
        if (Array.isArray(manifest.folders)) {
            for (const raw of manifest.folders.slice(0, 40)) {
                const folder = cleanFolder(raw);
                if (!folder)
                    continue;
                const same = CATEGORIES.find((item) => item.id === folder.id) || CATEGORIES.find((item) => item.label.toLocaleLowerCase('tr') === folder.label.toLocaleLowerCase('tr'));
                if (same)
                    folderMap.set(folder.id, same.id);
                else if (CATEGORIES.length < 20) {
                    CATEGORIES.push({ ...folder, dir: folderDirFor(folder.label) });
                    folderMap.set(folder.id, folder.id);
                }
            }
            saveFolders();
            renderAddFolder();
        }
        const known = new Set(songs.map((song) => song.id));
        let added = 0;
        let skipped = 0;
        for (const item of manifest.songs) {
            const entry = entries.find((candidate) => candidate.name === item.file);
            const id = typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID();
            if (!entry || known.has(id)) {
                skipped++;
                continue;
            }
            const type = typeof item.type === 'string' && item.type.startsWith('audio/') ? item.type : 'audio/mpeg';
            const blob = new Blob([await zipEntryBlob(file, entry)], { type });
            const duration = Number(item.duration) > 0 ? Number(item.duration) : await getDuration(blob);
            const song = {
                id,
                name: String(item.name || 'İsimsiz ses').slice(0, 80),
                blob,
                type,
                size: blob.size,
                duration,
                createdAt: Number(item.createdAt) || Date.now(),
                source: ['file', 'url', 'trim'].includes(item.source) ? item.source : 'file',
                favorite: item.favorite === true,
            };
            const mappedCategory = folderMap.get(item.category) || item.category;
            if (CATEGORIES.some((entryCategory) => entryCategory.id === mappedCategory))
                song.category = mappedCategory;
            await dbPut(song);
            songs.push(song);
            known.add(id);
            added++;
        }
        songs.sort((a, b) => b.createdAt - a.createdAt);
        renderLibrary();
        toast(`${added} ses geri yüklendi${skipped ? `, ${skipped} tanesi zaten vardı` : ''}.`);
    }
    catch (error) {
        toast(error instanceof Error ? error.message : 'Yedek yüklenemedi.', true);
    }
    finally {
        setBackupBusy(false);
    }
}
backupButton.addEventListener('click', () => void createBackup());
restoreButton.addEventListener('click', () => restoreInput.click());
restoreInput.addEventListener('change', () => {
    const file = restoreInput.files?.[0];
    restoreInput.value = '';
    if (!file)
        return;
    // Bulut yedeği (.json) favori ve dinleme verisini geri yükler; ZIP ise sesleri.
    if (/\.json$/i.test(file.name) || file.type === 'application/json') {
        if (cloudSync) void cloudSync.importCloudFile(file);
        else toast('Bulut yedeği şu an yüklenemiyor.', true);
    }
    else
        void restoreBackup(file);
});

// ---- v15: videodan sesi yeniden kodlamadan ayırma (MP4/MOV içindeki AAC → M4A) ----
// Ses akışı olduğu gibi yeni bir M4A kapsayıcıya taşınır: kayıpsız, anında ve çok küçük.
// AAC dışı sesli, parçalı (fragmented) veya tanınmayan dosyalarda null döner; uygulama eski yönteme (WAV) düşer.
async function extractAacFromMp4(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer);
    const type4 = (p) => String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]);
    function boxes(start, end) {
        const list = [];
        let p = start;
        while (p + 8 <= end) {
            let size = view.getUint32(p);
            const type = type4(p + 4);
            let header = 8;
            if (size === 1) {
                if (p + 16 > end)
                    break;
                size = Number(view.getBigUint64(p + 8));
                header = 16;
            }
            else if (size === 0)
                size = end - p;
            if (size < header || p + size > end)
                break;
            list.push({ type, start: p, body: p + header, end: p + size });
            p += size;
        }
        return list;
    }
    const child = (parent, name) => (parent ? boxes(parent.body, parent.end).find((box) => box.type === name) : undefined);
    const top = boxes(0, bytes.length);
    if (top.some((box) => box.type === 'moof'))
        return null;
    const moov = top.find((box) => box.type === 'moov');
    const mvhd = child(moov, 'mvhd');
    if (!moov || !mvhd)
        return null;
    let trak = null;
    for (const candidate of boxes(moov.body, moov.end).filter((box) => box.type === 'trak')) {
        const hdlr = child(child(candidate, 'mdia'), 'hdlr');
        if (hdlr && type4(hdlr.body + 8) === 'soun') {
            trak = candidate;
            break;
        }
    }
    if (!trak)
        return null;
    const stbl = child(child(child(trak, 'mdia'), 'minf'), 'stbl');
    if (!stbl)
        return null;
    const stsd = child(stbl, 'stsd');
    const stsz = child(stbl, 'stsz');
    const stsc = child(stbl, 'stsc');
    const stco = child(stbl, 'stco') || child(stbl, 'co64');
    if (!stsd || !stsz || !stsc || !stco || type4(stsd.body + 12) !== 'mp4a')
        return null;
    // 'mp4a' içinde MP3 de olabilir; yalnızca AAC (esds nesne türü 0x40, 0x66–0x68) M4A'ya taşınır.
    let objectType = -1;
    for (let p = stsd.body; p + 12 < stsd.end && objectType < 0; p++) {
        if (type4(p) !== 'esds')
            continue;
        let q = p + 8;
        while (q + 2 < stsd.end) {
            const tag = bytes[q++];
            let length = 0;
            for (let k = 0; k < 4; k++) {
                const part = bytes[q++];
                length = (length << 7) | (part & 0x7f);
                if (!(part & 0x80))
                    break;
            }
            if (tag === 0x03) {
                const flags = bytes[q + 2];
                q += 3;
                if (flags & 0x80)
                    q += 2;
                if (flags & 0x40)
                    q += 1 + bytes[q];
                if (flags & 0x20)
                    q += 2;
            }
            else if (tag === 0x04) {
                objectType = bytes[q];
                break;
            }
            else
                q += length;
        }
    }
    if (objectType !== 0x40 && (objectType < 0x66 || objectType > 0x68))
        return null;
    const fixedSize = view.getUint32(stsz.body + 4);
    const sampleCount = view.getUint32(stsz.body + 8);
    const sampleSize = (index) => fixedSize || view.getUint32(stsz.body + 12 + index * 4);
    const runCount = view.getUint32(stsc.body + 4);
    const chunkCount = view.getUint32(stco.body + 4);
    const is64 = stco.type === 'co64';
    if (!sampleCount || !runCount || !chunkCount)
        return null;
    const runs = [];
    for (let i = 0; i < runCount; i++)
        runs.push({ first: view.getUint32(stsc.body + 8 + i * 12), perChunk: view.getUint32(stsc.body + 12 + i * 12) });
    const chunks = [];
    const relativeOffsets = [];
    let sample = 0;
    let run = 0;
    let written = 0;
    for (let c = 0; c < chunkCount; c++) {
        while (run + 1 < runs.length && runs[run + 1].first <= c + 1)
            run++;
        let size = 0;
        for (let k = 0; k < runs[run].perChunk; k++) {
            if (sample >= sampleCount)
                return null;
            size += sampleSize(sample++);
        }
        const offset = is64 ? Number(view.getBigUint64(stco.body + 8 + c * 8)) : view.getUint32(stco.body + 8 + c * 4);
        if (offset + size > bytes.length)
            return null;
        chunks.push(bytes.subarray(offset, offset + size));
        relativeOffsets.push(written);
        written += size;
    }
    if (written + 8 > 0xffffffff)
        return null;
    const ftyp = new Uint8Array(28);
    const ftypView = new DataView(ftyp.buffer);
    ftypView.setUint32(0, 28);
    ftyp.set([0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20], 4); // ftyp, M4A
    ftyp.set([0x4d, 0x34, 0x41, 0x20, 0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d], 16); // M4A  mp42 isom
    const trakBytes = bytes.slice(trak.start, trak.end);
    const mvhdBytes = bytes.subarray(mvhd.start, mvhd.end);
    const moovSize = 8 + mvhdBytes.length + trakBytes.length;
    const dataStart = ftyp.length + moovSize + 8;
    const trakView = new DataView(trakBytes.buffer);
    const tableAt = stco.body - trak.start + 8;
    for (let c = 0; c < chunkCount; c++) {
        if (is64)
            trakView.setBigUint64(tableAt + c * 8, BigInt(dataStart + relativeOffsets[c]));
        else
            trakView.setUint32(tableAt + c * 4, dataStart + relativeOffsets[c]);
    }
    const moovHeader = new Uint8Array(8);
    new DataView(moovHeader.buffer).setUint32(0, moovSize);
    moovHeader.set([0x6d, 0x6f, 0x6f, 0x76], 4); // moov
    const mdatHeader = new Uint8Array(8);
    new DataView(mdatHeader.buffer).setUint32(0, 8 + written);
    mdatHeader.set([0x6d, 0x64, 0x61, 0x74], 4); // mdat
    return new Blob([ftyp, moovHeader, mvhdBytes, trakBytes, mdatHeader, ...chunks], { type: 'audio/mp4' });
}
async function extractVideoAudio(file) {
    if (/\.(mp4|m4v|mov)$/i.test(file.name) || /^video\/(mp4|quicktime)$/.test(file.type)) {
        try {
            setProgress('Videodan ses ayrılıyor…', 30);
            const direct = await extractAacFromMp4(file);
            if (direct)
                return direct;
        }
        catch { /* tanınmayan yapı; çözüp WAV üretme yoluna düşülür */ }
    }
    return extractAudioFromVideo(file);
}

const APP_VERSION = '36';
let deferredInstallPrompt = null;
let swRegistration = null;
let hadController = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
const installButton = get('install-button');
const updateButton = get('update-button');
const appStatus = get('app-status');
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function refreshAppCard() {
    if (isStandalone()) {
        installButton.hidden = true;
        appStatus.textContent = `Uygulama olarak çalışıyor · Sürüm ${APP_VERSION}`;
    }
    else {
        installButton.hidden = false;
        appStatus.textContent = deferredInstallPrompt ? `Ana ekrana yüklenmeye hazır · Sürüm ${APP_VERSION}` : `Tarayıcıda açık · Sürüm ${APP_VERSION}`;
    }
}
window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    refreshAppCard();
});
window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    toast('Ses Cebi ana ekrana yüklendi.');
    refreshAppCard();
});
window.matchMedia('(display-mode: standalone)').addEventListener?.('change', refreshAppCard);
installButton.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
        const promptEvent = deferredInstallPrompt;
        deferredInstallPrompt = null;
        try {
            await promptEvent.prompt();
            const choice = await promptEvent.userChoice;
            toast(choice.outcome === 'accepted' ? 'Yükleme başlatıldı.' : 'Yükleme iptal edildi.');
        }
        catch {
            toast('Yükleme penceresi açılamadı.', true);
        }
        refreshAppCard();
        return;
    }
    if (isIos) {
        toast('Safari’de Paylaş düğmesine dokun, ardından “Ana Ekrana Ekle”yi seç.');
        return;
    }
    toast('Tarayıcı menüsünden (⋮) “Uygulamayı yükle” veya “Ana ekrana ekle”yi seç. “Zaten yüklü” diyorsa eski kurulumu kaldırıp tekrar dene.', true);
});
async function checkForUpdates() {
    if (!('serviceWorker' in navigator)) {
        toast('Bu tarayıcı güncelleme denetimini desteklemiyor.', true);
        return;
    }
    updateButton.disabled = true;
    const label = updateButton.querySelector('span');
    if (label)
        label.textContent = 'Denetleniyor…';
    try {
        const registration = swRegistration || await navigator.serviceWorker.getRegistration('./');
        if (!registration)
            throw new Error('kayıt yok');
        await registration.update();
        if (registration.waiting)
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        if (registration.installing || registration.waiting)
            toast('Yeni sürüm bulundu, yükleniyor…');
        else
            toast(`Uygulama güncel · Sürüm ${APP_VERSION}`);
    }
    catch {
        toast('Güncelleme denetlenemedi. İnternet bağlantını kontrol et.', true);
    }
    finally {
        updateButton.disabled = false;
        if (label)
        label.textContent = 'Güncelle';
    }
}
updateButton.addEventListener('click', () => void checkForUpdates());
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController) {
            hadController = true;
            return;
        }
        if (audio.paused) {
            toast('Yeni sürüm yüklendi, yenileniyor…');
            window.setTimeout(() => window.location.reload(), 1200);
        }
        else
            toast('Yeni sürüm hazır. Çalan sesi bitirince sayfayı yenile.');
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible')
            swRegistration?.update().catch(() => undefined);
    });
}
async function diagnose() {
    const out = [];
    const ok = (good, text) => out.push((good ? '✔ ' : '✘ ') + text);
    ok(window.isSecureContext, 'Güvenli bağlantı (HTTPS)');
    ok('serviceWorker' in navigator, 'Service worker desteği');
    try {
        const reg = await navigator.serviceWorker.getRegistration('./');
        ok(!!reg && !!reg.active, 'Service worker etkin');
    }
    catch {
        ok(false, 'Service worker kaydı');
    }
    const link = document.querySelector('link[rel=manifest]');
    let manifest = null;
    try {
        const res = await fetch(link.href, { cache: 'no-store' });
        manifest = await res.json();
        ok(res.ok, `Manifest okundu (${res.status})`);
    }
    catch {
        ok(false, 'Manifest bulunamadı ya da bozuk');
    }
    if (manifest) {
        ok(manifest.display === 'standalone' || manifest.display === 'fullscreen', 'display ayarı');
        const sizes = (manifest.icons || []).map((i) => i.sizes).join(' ');
        ok(/192x192/.test(sizes) && /512x512/.test(sizes), '192 ve 512 simge tanımlı');
        for (const icon of manifest.icons || []) {
            try {
                const res = await fetch(new URL(icon.src, link.href), { cache: 'no-store' });
                ok(res.ok && (res.headers.get('content-type') || '').startsWith('image'), `${icon.src} (${res.status})`);
            }
            catch {
                ok(false, `${icon.src} yüklenemedi`);
            }
        }
    }
    ok(!!deferredInstallPrompt, 'Tarayıcı kurulum penceresine hazır');
    ok(!isStandalone(), 'Şu an tarayıcıda açık (uygulama olarak değil)');
    const diagBox = get('diag-output');
    diagBox.textContent = out.join('\n');
    diagBox.hidden = false;
}
get('diag-button').addEventListener('click', () => void diagnose());
refreshAppCard();
async function loadSharedFile() {
    if (!new URLSearchParams(location.search).has('shared'))
        return;
    try {
        const cache = await caches.open('sescebi-share');
        const key = new URL('shared-file', document.baseURI).href;
        const response = await cache.match(key);
        if (response) {
            const blob = await response.blob();
            const name = decodeURIComponent(response.headers.get('x-file-name') || 'paylasilan-dosya');
            switchTab('file');
            setSelectedFile(new File([blob], name, { type: blob.type }));
            toast('Dosya alındı. Onay kutusunu işaretleyip arşive ekle.');
            await cache.delete(key);
        }
    }
    catch { /* paylaşılan dosya okunamadı */ }
    history.replaceState(null, '', location.pathname);
}
async function init() {
    if (navigator.storage?.persist) {
        try {
            await navigator.storage.persist();
        }
        catch { /* Tarayıcı kalıcılığı reddedebilir; uygulama çalışmaya devam eder. */ }
    }
    try {
        songs = await dbGetAll();
        renderLibrary();
    }
    catch {
        toast('Yerel arşiv başlatılamadı. Tarayıcı depolama iznini kontrol et.', true);
    }
    try {
        cloudSync = initCloudSync({
            getSongs: () => songs,
            getStats: () => listeningStats,
            saveSong: (song) => dbPut(song),
            persistStats: () => persistListeningStats(),
            refresh: () => renderLibrary(),
            toast: (message, error) => toast(message, error),
            saveFile: (file) => saveFile(file, false),
        });
    }
    catch { /* bulut eşitleme başlatılamazsa uygulama yerel çalışmaya devam eder */ }
    await loadSharedFile();
    if ('serviceWorker' in navigator)
        navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then((registration) => { swRegistration = registration; }).catch(() => undefined);
}
void init();
