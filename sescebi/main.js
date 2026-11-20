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
let sleepTimerId = 0;
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
};
app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <div class="brand-cluster">
        <span class="publisher-name">ozguler forge</span>
        <a class="brand" href="/" aria-label="Ses Cebi ana sayfa">
          <span class="brand-mark">${icons.cassette}</span>
          <span class="brand-name">Ses Cebi</span>
        </a>
      </div>
      <div class="header-note"><span class="live-dot"></span><span>Bu cihazda, sana ait</span><button class="theme-toggle" id="theme-toggle" type="button" aria-label="Renk temasını değiştir">◐</button></div>
    </header>
    <nav class="main-nav" aria-label="Ana gezinme">
      <a class="sidebar-brand" href="/" aria-label="Ses Cebi ana sayfa"><span class="sidebar-brand-mark">${icons.cassette}</span><span class="sidebar-brand-copy">Ses Cebi<small>KİŞİSEL SES ALANI</small></span></a>
      <span class="nav-caption">ÇALIŞMA ALANI</span>
      <button class="nav-item active" type="button" data-screen="home"><span class="nav-symbol">⌂</span><span>Ana sayfa</span></button>
      <button class="nav-item" type="button" data-screen="library"><span class="nav-symbol">▤</span><span>Ses arşivi</span><span class="nav-count" id="nav-count">0</span></button>
      <button class="nav-item" type="button" data-screen="studio"><span class="nav-symbol">〽</span><span>Ses stüdyosu</span></button>
      <div class="sidebar-bottom"><span class="sidebar-status"><i></i> Yalnızca bu cihazda</span><span class="sidebar-version">SES CEBİ · SÜRÜM 22</span></div>
    </nav>

    <main>
      <section class="screen-view active" id="screen-home">
        <div class="page-heading"><div><p class="page-kicker">KİŞİSEL SES ALANIN</p><h1>Seslerini, <em>özgürce.</em></h1><p class="page-subtitle">Kaydet, düzenle ve kendi arşivinden dinle. Her şey bu cihazda kalır.</p></div><span class="today-chip"><i></i> Çevrimdışı kullanıma hazır</span></div>
        <section class="metric-row" aria-label="Arşiv özeti">
          <article class="metric-card"><span class="metric-icon mint">♫</span><div><span class="metric-label">ARŞİVİNDE</span><strong id="stat-count">0</strong><small>ses kaydı</small></div><span class="metric-art art-lines"></span></article>
          <article class="metric-card"><span class="metric-icon lilac">♡</span><div><span class="metric-label">SEVDİKLERİN</span><strong id="stat-favorites">0</strong><small>favori kayıt</small></div><span class="metric-art art-orbit"></span></article>
          <article class="metric-card"><span class="metric-icon amber">◷</span><div><span class="metric-label">ARŞİV BOYUTU</span><strong id="stat-storage">0 B</strong><small>bu cihazda saklı</small></div><span class="metric-art art-bars"></span></article>
        </section>
        <section class="listening-stats" id="listening-stats-panel" aria-labelledby="listening-stats-title">
          <div class="stats-heading"><div><p class="section-kicker">BU CİHAZDAKİ DİNLEME GEÇMİŞİN</p><h2 id="listening-stats-title">Dinleme özeti</h2><p>Seslerini nasıl kullandığını sadece sen görebilirsin.</p></div><span class="stats-local-badge"><i></i> YEREL İSTATİSTİK</span></div>
          <div class="listening-stats-grid">
            <article class="listen-stat-card"><span class="listen-stat-icon play-stat">▶</span><div><span class="listen-stat-label">TOPLAM ÇALMA</span><strong id="stat-play-count">0</strong><small>oynatma başlangıcı</small></div></article>
            <article class="listen-stat-card"><span class="listen-stat-icon time-stat">◷</span><div><span class="listen-stat-label">DİNLEME SÜRESİ</span><strong id="stat-listen-time">0 sn</strong><small>aktif dinleme zamanı</small></div></article>
            <article class="listen-stat-card"><span class="listen-stat-icon tracks-stat">♫</span><div><span class="listen-stat-label">FARKLI KAYIT</span><strong id="stat-unique-tracks">0</strong><small>dinlemeye başladığın ses</small></div></article>
            <article class="listen-stat-card top-track-stat"><span class="listen-stat-icon top-stat">✦</span><div><span class="listen-stat-label">EN ÇOK DİNLENEN</span><strong id="stat-top-track">Henüz yok</strong><small id="stat-top-play-count">Bir ses çaldığında burada</small></div></article>
          </div>
          <p class="stats-footnote"><span aria-hidden="true">◈</span> İstatistikler bu tarayıcıda saklanır; Google hesabına veya sunucuya gönderilmez.</p>
        </section>
        <div class="home-workspace">
          <div class="home-primary">
            <section class="card add-card" aria-labelledby="add-title">
              <div class="card-heading"><div><p class="section-kicker">YENİ KAYIT</p><h2 id="add-title">Arşivine ses ekle</h2><p>Bir dosya seç ya da izinli, doğrudan bir ses bağlantısı ekle.</p></div><span class="stamp"><i></i> CİHAZDA</span></div>
              <div class="tabs" role="tablist" aria-label="Ses ekleme yöntemi"><button class="tab active" type="button" role="tab" aria-selected="true" data-tab="file">Dosya yükle</button><button class="tab" type="button" role="tab" aria-selected="false" data-tab="url">Bağlantıdan ekle</button></div>
              <div id="file-panel" role="tabpanel"><label class="file-drop" for="file-input"><span class="upload-icon">${icons.upload}</span><strong>Dosyanı buraya bırak veya <u>göz at</u></strong><span>MP3, M4A, WAV, OGG veya video · en fazla 100 MB</span><input id="file-input" type="file" accept="audio/*,video/*,.mp3,.m4a,.wav,.ogg,.aac,.flac,.mp4,.m4v,.mov,.webm,.mkv" /></label><p class="file-name" id="file-name" aria-live="polite">Henüz dosya seçilmedi</p></div>
              <div id="url-panel" class="url-panel" role="tabpanel" hidden><label class="sr-only" for="url-input">Doğrudan ses dosyası bağlantısı</label><input class="text-input" id="url-input" type="url" inputmode="url" placeholder="https://site.com/ses.mp3" autocomplete="off" /><p class="url-hint">Herkese açık, doğrudan ses dosyası bağlantıları desteklenir.</p></div>
              <label class="consent"><input id="consent" type="checkbox" /><span>Bu sesi kullanma ve indirme hakkına sahibim veya izin aldım.</span></label>
              <button class="primary-button" id="add-button" type="button" disabled>${icons.plus}<span>Arşive ekle</span></button>
              <div class="progress-wrap" id="progress-wrap" aria-live="polite"><div class="progress-line"><span id="progress-label">Hazırlanıyor…</span><strong id="progress-value">0%</strong></div><progress id="progress" max="100" value="0">0%</progress></div>
            </section>
            <div class="player" id="player" aria-live="polite"><div class="player-top"><div class="player-art">${icons.cassette}</div><div class="player-title"><strong id="player-title">—</strong><span id="player-subtitle">Çalmaya hazır</span></div></div><div class="player-controls"><button class="player-button small" id="back-button" type="button" aria-label="10 saniye geri sar">${icons.rewind}</button><button class="player-button" id="play-button" type="button" aria-label="Oynat">${icons.play}</button><button class="player-button small" id="forward-button" type="button" aria-label="10 saniye ileri sar">${icons.forward}</button><input class="seek" id="seek" type="range" min="0" max="100" value="0" aria-label="Ses ilerlemesi" /><span class="time" id="time">00:00 / 00:00</span></div><div class="player-extra"><button class="chip" id="prev-button" type="button">Önceki</button><button class="chip" id="next-button" type="button">Sonraki</button><button class="chip" id="mode-button" type="button">Sırayla çal</button><label class="speed-control">Hız <select id="playback-speed" aria-label="Oynatma hızı"><option value="0.75">0,75×</option><option value="1" selected>1×</option><option value="1.25">1,25×</option><option value="1.5">1,5×</option><option value="2">2×</option></select></label><button class="chip" id="sleep-button" type="button">Uyku zamanlayıcısı</button></div></div>
            <section class="install-panel" aria-label="Ses Cebi uygulamasını yükle">
              <div class="install-mark" aria-hidden="true">${icons.cassette}</div>
              <div class="install-copy"><span class="install-eyebrow">KİŞİSEL ARŞİVİN · HER AN YANINDA</span><strong>Ses Cebi, hep yanında.</strong><span>Uygulamayı cihazına ekle; ses arşivin tek dokunuşla açılsın.</span><small id="app-status">Sürüm 21 · İsteğe bağlı kurulum</small></div>
              <div class="app-card-actions"><button class="primary-button install-button" id="install-button" type="button">${icons.download}<span>Uygulamayı yükle</span></button><button class="ghost-button" id="update-button" type="button"><span>Güncelle</span></button><button class="ghost-button" id="diag-button" type="button"><span>Durum</span></button></div>
            </section>
          </div>
          <aside class="home-aside"><section class="card recent-card"><div class="aside-heading"><div><p class="section-kicker">KÜTÜPHANENDEN</p><h2>Son eklenenler</h2></div><button class="text-link" type="button" data-screen="library">Tümünü gör <span>↗</span></button></div><div id="dashboard-recent" class="recent-list"></div><div id="dashboard-empty" class="recent-empty"><span class="recent-empty-icon">♫</span><strong>Burada ilk parçan görünecek</strong><span>Bir ses ekleyerek kişisel arşivini oluşturmaya başla.</span></div></section><section class="privacy-card"><span class="privacy-icon">◈</span><div><strong>Senin seslerin, senin cihazında.</strong><p>Hesap yok, yükleme yok. Arşivini dilediğinde dışa aktarabilirsin.</p></div></section></aside>
        </div>
      </section>
      <section class="screen-view" id="screen-library">
        <div class="page-heading library-page-heading"><div><p class="page-kicker">SENİN KÜTÜPHANEN</p><h1>Ses arşivi</h1><p class="page-subtitle">Bu cihazda saklanan kayıtlarını bul, dinle ve düzenle.</p></div><button class="primary-button library-add-button" type="button" id="library-add">${icons.plus}<span>Ses ekle</span></button></div>
        <section class="card library-card" aria-labelledby="library-title">
          <div class="studio-picker-banner" id="studio-picker-banner" hidden role="status"><div><strong>Stüdyo için bir ses seç</strong><span>İşlemek istediğin kaydın yanındaki düğmeye dokun.</span></div><button class="ghost-button" id="studio-picker-cancel" type="button">Vazgeç</button></div><div class="library-header"><div><h2 id="library-title">Tüm kayıtlar</h2><span class="library-count" id="library-count">0 kayıt</span></div><span class="stamp"><i></i> YALNIZCA SENDE</span></div>
          <div class="library-tools"><label class="search-wrap"><span class="search-symbol">⌕</span><input class="text-input library-search" id="library-search" type="search" placeholder="Kayıtlarında ara…" aria-label="Arşivde ara" /></label><select class="text-input library-sort" id="library-sort" aria-label="Arşivi sırala"><option value="newest">Son eklenen</option><option value="oldest">İlk eklenen</option><option value="az">İsim A–Z</option><option value="duration">En uzun</option></select><button class="ghost-button filter-chip" id="favorites-filter" type="button" aria-pressed="false">♡ <span>Favoriler</span></button></div>
          <div class="library-subtools"><span>Dosyaların cihazında kalır ve çevrimdışı kullanılabilir.</span><div class="backup-row"><button class="ghost-button" id="backup-button" type="button">${icons.download}<span>Yedek al</span></button><button class="ghost-button" id="restore-button" type="button">${icons.upload}<span>Yedeği yükle</span></button><input id="restore-input" type="file" accept=".zip,application/zip" aria-label="Yedek dosyası seç" /></div></div>
          <div class="empty-state" id="empty-state"><div class="empty-icon">${icons.cassette}</div><h3>Arşivin yeni başlıyor</h3><p>İlk kaydını eklediğinde, burada düzenli ve çevrimdışı erişilebilir şekilde göreceksin.</p><button type="button" class="text-link empty-add" data-screen="home">İlk sesini ekle <span>→</span></button></div>
          <div class="song-list" id="song-list"></div>
        </section>
      </section>
      <section class="screen-view" id="screen-studio">
        <div class="page-heading"><div><p class="page-kicker">YARATICI ARAÇLAR</p><h1>Ses stüdyosu</h1><p class="page-subtitle">Kayıtlarını istediğin gibi kes, şekillendir ve yeni bir parçaya dönüştür.</p></div></div>
        <section class="studio-workbench"><div class="studio-copy"><span class="studio-overline"><i></i> DÜZENLEME ALANI</span><h2>Bir sesi, <em>kendine göre</em> düzenle.</h2><p>Arşivinden kayıt seçerek kesme alanını aç. Dalga formunda aralığı belirle, yumuşak geçişler ve ton ayarları ekle; yeni kesitini WAV olarak kaydet.</p><button class="primary-button" id="studio-open-library" type="button">Arşivimden kayıt seç <span>→</span></button><div class="studio-capabilities"><span>01 <b>Hassas kesim</b></span><span>02 <b>Fade geçişleri</b></span><span>03 <b>Bas / tiz</b></span></div></div><div class="workbench-art" aria-hidden="true"><div class="workbench-grid"></div><div class="waveform"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><span class="wave-cursor"></span><span class="workbench-label">WAVEFORM · EDITOR</span></div></section>
        <div class="studio-feature-grid"><article><span class="feature-number">01</span><div><strong>Kes ve yeniden çerçevele</strong><p>Yakınlaştır, dalgayı incele ve başlangıç / bitişi hassasça seç.</p></div><span class="feature-glyph">⌁</span></article><article><span class="feature-number">02</span><div><strong>Geçişleri yumuşat</strong><p>Fade-in ve fade-out ile doğal başlangıç ve bitişler oluştur.</p></div><span class="feature-glyph">◒</span></article><article><span class="feature-number">03</span><div><strong>Tonu şekillendir</strong><p>Bas ve tiz kontrolleriyle sesin karakterini ayarla.</p></div><span class="feature-glyph">≋</span></article></div>
      </section>
    </main>

    <footer class="site-footer" aria-label="Uygulama bilgileri ve yasal bilgiler">
      <div class="footer-showcase">
        <div class="footer-brand">
          <div class="footer-brand-mark" aria-hidden="true">${icons.cassette}</div>
          <div class="footer-brand-copy"><span class="footer-eyebrow">SES CEBİ · KİŞİSEL SES ALANI</span><h2>Her ses senin.<br><em>Arşivin de öyle.</em></h2><p>Kayıtların bu cihazda kalır; uygulama sunucusuna yüklenmez.</p></div>
        </div>
        <div class="footer-contact"><span class="footer-contact-label">OZGULER FORGE</span><a href="https://ozgulerforge.com.tr" target="_blank" rel="noreferrer"><span>Web sitesi</span><span>ozgulerforge.com.tr ↗</span></a><a href="mailto:iletisim@ozgulerforge.com.tr"><span>Bize ulaşın</span><span>iletisim@ozgulerforge.com.tr ↗</span></a></div>
      </div>
      <div class="legal-grid">
        <section><span class="legal-index">01 / İÇERİK</span><h3>Kullanım ve telif</h3><p>Ses Cebi yalnızca sahip olduğunuz veya kullanma ve indirme izniniz bulunan içerikler için kullanılmalıdır. İçerik hakları ilgili sahiplerine aittir; izinsiz çoğaltma, dağıtma veya ticari kullanım kullanıcının sorumluluğundadır.</p></section>
        <section><span class="legal-index">02 / GİZLİLİK</span><h3>Gizlilik ve depolama</h3><p>Bu sürümde hesap oluşturulmaz. Eklediğiniz sesler tarayıcının yerel depolamasında tutulur. Tarayıcı verilerini temizlemek, uygulamayı kaldırmak veya cihaz depolamasının silinmesi kayıtların kaybolmasına neden olabilir.</p></section>
        <section><span class="legal-index">03 / ERİŞİM</span><h3>Platform sınırları</h3><p>Uygulama Instagram’a giriş yapmaz; özel hesaplara, korumalı içeriğe veya platform kısıtlarını aşmaya yönelik erişim sağlamaz. Yalnızca herkese açık ve izinli doğrudan medya bağlantıları desteklenir.</p></section>
      </div>
      <div class="legal-note"><span class="legal-note-mark" aria-hidden="true">i</span><p>Uygulamayı kullanarak yukarıdaki kullanım, telif ve depolama koşullarını kabul etmiş olursunuz. Yasal haklarınız ve yükümlülükleriniz için ilgili mevzuatı ve içerik sahibinin izin şartlarını ayrıca kontrol edin.</p></div>
      <div class="footer-bottom"><span>OZGULER FORGE <i>·</i> SES CEBİ</span><span>YEREL <i>·</i> KİŞİSEL <i>·</i> SANA AİT</span></div>
    </footer>
  </div>
  <div class="overlay" id="trim-overlay" hidden>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="trim-title">
      <div class="sheet-head"><h2 id="trim-title">Sesi kes</h2><button class="icon-button" id="trim-close" type="button" aria-label="Kapat">✕</button></div>
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
      <div class="trim-zoom"><label for="wave-zoom">Dalga yakınlaştırma</label><input id="wave-zoom" type="range" min="1" max="8" step="0.5" value="1" /><output id="wave-zoom-value">1×</output></div>
      <div class="trim-effects"><label>Fade-in <span><input id="fade-in" type="range" min="0" max="5" step="0.1" value="0" /><output id="fade-in-value">0 sn</output></span></label><label>Fade-out <span><input id="fade-out" type="range" min="0" max="5" step="0.1" value="0" /><output id="fade-out-value">0 sn</output></span></label><label>Bas <span><input id="trim-bass" type="range" min="-12" max="12" step="1" value="0" /><output id="trim-bass-value">0 dB</output></span></label><label>Tiz <span><input id="trim-treble" type="range" min="-12" max="12" step="1" value="0" /><output id="trim-treble-value">0 dB</output></span></label></div>
      <label class="consent sheet-check"><input id="trim-keep" type="checkbox" checked /><span>Orijinal ses de arşivde kalsın</span></label>
      <div class="sheet-actions"><button class="ghost-button" id="trim-preview" type="button" disabled>Seçimi dinle</button><button class="primary-button" id="trim-save" type="button" disabled>${icons.scissors}<span>Kes ve kaydet</span></button></div>
      <p class="sheet-sub small">Kesilen bölüm WAV olarak yeni bir kayıt olur; WAV her telefonun müzik çalarında çalar.</p>
    </div>
  </div>
  <div class="overlay" id="info-overlay" hidden>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="info-title">
      <div class="sheet-head"><h2 id="info-title">Kayıt bilgisi</h2><button class="icon-button" id="info-close" type="button" aria-label="Kapat">✕</button></div>
      <div id="info-body"></div>
      <div class="sheet-actions"><button class="ghost-button" id="info-share" type="button" hidden>${icons.share}<span>Paylaş</span></button><button class="primary-button" id="info-ok" type="button">Tamam</button></div>
    </div>
  </div>
  <div class="overlay" id="rename-overlay" hidden>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rename-title">
      <div class="sheet-head"><h2 id="rename-title">Adı değiştir</h2><button class="icon-button" id="rename-close" type="button" aria-label="Kapat">✕</button></div>
      <label class="sr-only" for="rename-input">Yeni ad</label>
      <input class="text-input" id="rename-input" type="text" maxlength="80" autocomplete="off" />
      <div class="sheet-actions rename-actions"><button class="primary-button" id="rename-save" type="button">Kaydet</button></div>
    </div>
  </div>
  <div class="toast" id="toast" role="status"></div>
`;
function placeListeningStatsPanel() {
    const statsPanel = app.querySelector('#listening-stats-panel');
    const sidebar = app.querySelector('.main-nav');
    const homeScreen = app.querySelector('#screen-home');
    const archiveSummary = homeScreen?.querySelector('.metric-row');
    if (!statsPanel || !sidebar || !homeScreen || !archiveSummary)
        return;
    if (window.matchMedia('(min-width: 851px)').matches) {
        const sidebarFooter = sidebar.querySelector('.sidebar-bottom');
        if (sidebarFooter && statsPanel.parentElement !== sidebar)
            sidebar.insertBefore(statsPanel, sidebarFooter);
        statsPanel.classList.add('is-sidebar');
        return;
    }
    if (statsPanel.parentElement !== homeScreen)
        archiveSummary.after(statsPanel);
    statsPanel.classList.remove('is-sidebar');
}
window.addEventListener('resize', placeListeningStatsPanel);
placeListeningStatsPanel();
const fileInput = get('file-input');
const fileName = get('file-name');
const consent = get('consent');
const addButton = get('add-button');
const urlInput = get('url-input');
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
const infoBody = get('info-body');
const infoShareButton = get('info-share');
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
        const parsed = JSON.parse(window.localStorage.getItem(LISTENING_STATS_KEY) || '{}');
        const tracks = Object.create(null);
        if (parsed && parsed.tracks && typeof parsed.tracks === 'object') {
            for (const [id, entry] of Object.entries(parsed.tracks)) {
                if (!entry || typeof entry !== 'object') continue;
                tracks[id] = { name: typeof entry.name === 'string' ? entry.name : 'Ses kaydı', plays: Math.max(0, Number(entry.plays) || 0), seconds: Math.max(0, Number(entry.seconds) || 0) };
            }
        }
        return { tracks };
    } catch { return { tracks: Object.create(null) }; }
}
function persistListeningStats() {
    try { window.localStorage.setItem(LISTENING_STATS_KEY, JSON.stringify(listeningStats)); } catch { /* depolama kapalı olsa da oturum içi sayaçlar çalışır */ }
    renderListeningStats();
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
    get('stat-top-track').textContent = top ? (songs.find((song) => String(song.id) === top[0])?.name || top[1].name || 'Ses kaydı') : 'Henüz yok';
    get('stat-top-play-count').textContent = top ? `${top[1].plays} kez çalındı` : 'Bir ses çaldığında burada';
}
function startListeningSession() {
    if (!activeSong || listeningSession) return;
    const id = String(activeSong.id);
    const entry = listeningStats.tracks[id] || { name: activeSong.name, plays: 0, seconds: 0 };
    entry.name = activeSong.name;
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
    addButton.disabled = !consent.checked || !hasSource;
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
    setProgress('Ses dosyası hazırlanıyor…', 75);
    await new Promise((resolve) => setTimeout(resolve, 30));
    return encodeWav(decoded);
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
        await dbPut(song);
        songs = [song, ...songs];
        renderLibrary();
        resetSource();
        setProgress('Kaydedildi', 100);
        toast('Ses cihazdaki arşivine eklendi.');
        window.setTimeout(() => setProgress('', 0, false), 850);
    }
    catch (error) {
        setProgress('', 0, false);
        toast(error instanceof Error ? error.message : 'Ses eklenirken beklenmeyen bir sorun oluştu.', true);
    }
    finally {
        updateAddButton();
    }
}
function resetSource() {
    selectedFile = null;
    fileInput.value = '';
    fileName.textContent = 'Henüz dosya seçilmedi';
    urlInput.value = '';
    consent.checked = false;
    updateAddButton();
}
function renderLibrary() {
    const search = searchQuery.trim().toLocaleLowerCase('tr');
    let visibleSongs = songs.filter((song) => (!favoritesOnly || song.favorite) && (!search || song.name.toLocaleLowerCase('tr').includes(search)));
    visibleSongs = [...visibleSongs].sort((a, b) => sortMode === 'oldest' ? a.createdAt - b.createdAt : sortMode === 'az' ? a.name.localeCompare(b.name, 'tr') : sortMode === 'duration' ? (b.duration || 0) - (a.duration || 0) : b.createdAt - a.createdAt);
    libraryCount.textContent = `${songs.length} kayıt · ${visibleSongs.length} gösteriliyor`;
    get('nav-count').textContent = String(songs.length);
    get('stat-count').textContent = String(songs.length);
    get('stat-favorites').textContent = String(songs.filter((song) => song.favorite).length);
    get('stat-storage').textContent = songs.length ? formatSize(songs.reduce((sum, song) => sum + (song.size || 0), 0)) : '0 B';
    renderListeningStats();
    const recent = get('dashboard-recent');
    const recentSongs = [...songs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
    recent.innerHTML = recentSongs.map((song, index) => `<button class="recent-row" type="button" data-play-recent="${song.id}"><span class="recent-cover tone-${index % 4}">${icons.cassette}</span><span class="recent-track"><strong>${escapeHtml(song.name)}</strong><small>${formatTime(song.duration)} <i>·</i> ${formatSize(song.size)}</small></span><span class="recent-play">${icons.play}</span></button>`).join('');
    get('dashboard-empty').hidden = songs.length > 0;
    recent.hidden = songs.length === 0;
    recent.querySelectorAll('[data-play-recent]').forEach((button) => button.addEventListener('click', () => {
        const song = songs.find((item) => item.id === button.dataset.playRecent);
        if (song) void toggleSong(song);
    }));
    emptyState.hidden = visibleSongs.length > 0;
    if (songs.length > 0 && visibleSongs.length === 0) { emptyState.querySelector('h3').textContent = 'Eşleşen kayıt bulunamadı'; emptyState.querySelector('p').textContent = 'Arama sözcüğünü veya favori filtresini değiştirebilirsin.'; }
    else { emptyState.querySelector('h3').textContent = 'Arşivin yeni başlıyor'; emptyState.querySelector('p').textContent = 'İlk kaydını eklediğinde, burada düzenli ve çevrimdışı erişilebilir şekilde göreceksin.'; }
    songList.innerHTML = visibleSongs.map((song, index) => `
    <article class="song-row" data-song-id="${song.id}">
      <div class="song-cover cover-tone-${index % 5}"><span class="cover-orbit"></span><span class="cover-mark">${icons.cassette}</span><small>${song.source === 'trim' ? 'EDIT' : song.source === 'url' ? 'LINK' : 'AUDIO'}</small></div>
      <div class="song-main"><p class="song-name" title="${escapeHtml(song.name)}">${escapeHtml(song.name)}</p><div class="song-meta"><span>${formatTime(song.duration)}</span><span class="meta-dot">·</span><span>${formatSize(song.size)}</span><span class="meta-dot">·</span><span class="status-pill">Cihazda</span></div><span class="song-created">${new Date(song.createdAt).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' })}</span></div>
      <div class="song-actions"><button class="primary-button studio-select-row" type="button" hidden>${icons.scissors}<span>Stüdyoda aç</span></button><button class="icon-button favorite-row ${song.favorite ? 'is-favorite' : ''}" type="button" aria-label="${song.favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}">${song.favorite ? '♥' : '♡'}</button><button class="icon-button play-row" type="button" aria-label="${activeSong?.id === song.id && !audio.paused ? 'Duraklat' : 'Oynat'}: ${escapeHtml(song.name)}">${activeSong?.id === song.id && !audio.paused ? icons.pause : icons.play}</button><button class="icon-button more-row" type="button" aria-label="Daha fazla işlem" aria-expanded="false">···</button><div class="song-more-actions" hidden><button class="rename-row" type="button">${icons.edit}<span>Yeniden adlandır</span></button><button class="trim-row" type="button">${icons.scissors}<span>Sesi kes</span></button><button class="share-row" type="button">${icons.share}<span>Paylaş</span></button><button class="download-row" type="button">${icons.download}<span>İndir</span></button><button class="delete-row" type="button">${icons.trash}<span>Sil</span></button></div></div>
    </article>`).join('');
    songList.querySelectorAll('.song-row').forEach((row) => {
        const id = row.dataset.songId;
        const song = songs.find((item) => item.id === id);
        if (!song) return;
        const studioButton = row.querySelector('.studio-select-row');
        const rowActions = row.querySelector('.song-actions');
        rowActions?.classList.toggle('studio-picking', studioSelectionMode);
        row.querySelectorAll('.favorite-row, .play-row, .more-row').forEach((control) => { control.hidden = studioSelectionMode; });
        if (studioButton) studioButton.hidden = !studioSelectionMode;
        studioButton?.addEventListener('click', () => void chooseStudioSong(song));
        row.querySelector('.favorite-row')?.addEventListener('click', () => void toggleFavorite(song));
        row.querySelector('.play-row')?.addEventListener('click', () => toggleSong(song));
        row.querySelector('.more-row')?.addEventListener('click', (event) => {
            const button = event.currentTarget;
            const menu = row.querySelector('.song-more-actions');
            const open = menu.hidden;
            document.querySelectorAll('.song-row.menu-open').forEach((openRow) => {
                if (openRow !== row) {
                    openRow.classList.remove('menu-open');
                    const openMenu = openRow.querySelector('.song-more-actions');
                    const openButton = openRow.querySelector('.more-row');
                    if (openMenu) openMenu.hidden = true;
                    openButton?.setAttribute('aria-expanded', 'false');
                }
            });
            menu.hidden = !open;
            row.classList.toggle('menu-open', open);
            button.setAttribute('aria-expanded', String(open));
        });
        row.querySelector('.rename-row')?.addEventListener('click', () => openRename(song));
        row.querySelector('.trim-row')?.addEventListener('click', () => void openTrim(song));
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
    try { await dbPut(song); renderLibrary(); }
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
    playerTitle.textContent = song.name;
    updateMediaSession();
    playerSubtitle.textContent = `${song.source === 'url' ? 'İzinli bağlantı' : song.source === 'trim' ? 'Kesit' : 'Dosya'} · cihazda saklanıyor`;
    seek.value = '0';
    updatePlayerUI();
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
    playButton.setAttribute('aria-label', audio.paused ? 'Oynat' : 'Duraklat');
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : activeSong.duration;
    const current = audio.currentTime || 0;
    seek.max = String(duration || 100);
    seek.value = String(current);
    timeLabel.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    updatePositionState();
    playerSubtitle.textContent = audio.paused ? 'Duraklatıldı · cihazda saklı' : 'Şimdi çalıyor · cihazda saklı';
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
    node.hidden = false;
    document.body.classList.add('modal-open');
}
function closeOverlay(node) {
    node.hidden = true;
    if (trimOverlay.hidden && infoOverlay.hidden && renameOverlay.hidden)
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
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    showSaveInfo(file, undefined, isAudio);
}
function canShareFile(file) {
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}
async function shareFile(file, title) {
    if (!canShareFile(file)) {
        toast('Bu tarayıcı dosya paylaşmayı desteklemiyor. Dosyayı indirip mail veya Drive içinden ekleyebilirsin.', true);
        return;
    }
    if (file.size > 25 * 1024 * 1024)
        toast(`Dosya ${formatSize(file.size)}. Mail eki sınırı genelde 25 MB; büyük dosyada Drive’ı seç.`);
    try {
        await navigator.share({ files: [file], title });
    }
    catch (error) {
        if (!(error && error.name === 'AbortError'))
            toast('Paylaşım penceresi açılamadı.', true);
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
        toast('Bu tarayıcı doğrudan paylaşmayı desteklemiyor; dosya indiriliyor. İndirince mail veya Drive içinden ekleyebilirsin.', true);
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
            player.classList.remove('visible');
        }
        renderLibrary();
        toast('Ses arşivden silindi.');
    }
    catch {
        toast('Ses silinemedi; cihaz depolamasını kontrol et.', true);
    }
}
fileInput.addEventListener('change', () => {
    selectedFile = fileInput.files?.[0] || null;
    fileName.textContent = selectedFile ? `${selectedFile.name} · ${formatSize(selectedFile.size)}` : 'Henüz dosya seçilmedi';
    updateAddButton();
});
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
audio.addEventListener('ended', () => { flushListeningSession(true); updatePlayerUI(); renderLibrary(); void handleEnded(); });
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
    const index = songs.findIndex((song) => song.id === activeSong?.id);
    if (index < 0)
        return null;
    let target = index + step;
    if (target < 0 || target >= songs.length) {
        if (!wrap)
            return null;
        target = (target + songs.length) % songs.length;
    }
    return songs[target] || null;
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
    if (playMode === 'once')
        return;
    if (playMode === 'one') {
        audio.currentTime = 0;
        await audio.play().catch(() => undefined);
        return;
    }
    const next = playMode === 'shuffle' ? songs.filter((song) => song.id !== activeSong?.id)[Math.floor(Math.random() * Math.max(1, songs.length - 1))] : neighborSong(1, playMode === 'loop');
    if (next)
        await playSong(next);
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
    const next = playMode === 'shuffle' ? songs.filter((song) => song.id !== activeSong?.id)[Math.floor(Math.random() * Math.max(1, songs.length - 1))] : neighborSong(1, playMode === 'loop');
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
get('library-search').addEventListener('input', (event) => { searchQuery = event.target.value; renderLibrary(); });
get('library-sort').addEventListener('change', (event) => { sortMode = event.target.value; renderLibrary(); });
get('favorites-filter').addEventListener('click', (event) => { favoritesOnly = !favoritesOnly; event.currentTarget.setAttribute('aria-pressed', String(favoritesOnly)); event.currentTarget.classList.toggle('active', favoritesOnly); renderLibrary(); });
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
document.querySelectorAll('[data-screen]').forEach((button) => button.addEventListener('click', () => {
  const target = button.dataset.screen;
  if (target !== 'library' && studioSelectionMode) { studioSelectionMode = false; get('studio-picker-banner').hidden = true; renderLibrary(); }
  document.querySelectorAll('.screen-view').forEach((view) => view.classList.toggle('active', view.id === `screen-${target}`));
  document.querySelectorAll('[data-screen]').forEach((item) => item.classList.toggle('active', item === button));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}));
get('studio-open-library').addEventListener('click', () => {
  studioSelectionMode = true;
  get('studio-picker-banner').hidden = false;
  renderLibrary();
  document.querySelector('[data-screen="library"]').click();
});
window.addEventListener('pagehide', () => flushListeningSession(true));
window.setInterval(() => flushListeningSession(false), 5000);
get('studio-picker-cancel').addEventListener('click', () => {
  studioSelectionMode = false;
  get('studio-picker-banner').hidden = true;
  renderLibrary();
  document.querySelector('[data-screen="studio"]').click();
});
get('library-add').addEventListener('click', () => document.querySelector('[data-screen="home"]').click());

const themeToggle = get('theme-toggle');
try { if (localStorage.getItem('sescebi-theme') === 'dark') document.documentElement.dataset.theme = 'dark'; } catch {}
themeToggle.addEventListener('click', () => { const dark = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : 'light'; try { localStorage.setItem('sescebi-theme', dark ? 'dark' : 'light'); } catch {} });
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
        const manifest = { app: 'sescebi', version: 1, created: new Date().toISOString(), songs: [] };
        for (let i = 0; i < songs.length; i++) {
            const song = songs[i];
            const format = await detectFormat(song.blob, song.type);
            const file = `sesler/${String(i + 1).padStart(3, '0')}-${safeFileName(song.name)}.${format.ext}`;
            entries.push({ name: file, blob: song.blob });
            manifest.songs.push({ id: song.id, name: song.name, duration: song.duration, source: song.source, createdAt: song.createdAt, favorite: !!song.favorite, type: format.mime, file });
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
    if (file)
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

const APP_VERSION = '22';
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
            label.textContent = 'Güncellemeleri denetle';
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
    window.alert(out.join('\n'));
}
get('diag-button').addEventListener('click', () => void diagnose());
refreshAppCard();
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
    if ('serviceWorker' in navigator)
        navigator.serviceWorker.register('./sw.js?v=17', { scope: './' }).then((registration) => { swRegistration = registration; }).catch(() => undefined);
}
void init();
