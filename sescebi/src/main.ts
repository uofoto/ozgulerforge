import './styles.css';

type SourceType = 'file' | 'url' | 'trim';

type StoredSong = {
  id: string;
  name: string;
  blob: Blob;
  type: string;
  size: number;
  duration: number;
  createdAt: number;
  source: SourceType;
};

type TrimSession = {
  song: StoredSong;
  buffer: AudioBuffer | null;
  peaks: Float32Array | null;
  start: number;
  end: number;
  preview: HTMLAudioElement | null;
  previewUrl: string;
  playhead: number;
};

const DB_NAME = 'sescebi-db';
const STORE_NAME = 'songs';
const MAX_SIZE = 100 * 1024 * 1024;
const MAX_TRIM_SECONDS = 15 * 60;
const MIN_CLIP = 0.2;

const audio = new Audio();
let songs: StoredSong[] = [];
let activeSong: StoredSong | null = null;
let activeObjectUrl = '';
let selectedFile: File | null = null;
let activeTab: 'file' | 'url' = 'file';
let toastTimer = 0;
let trimState: TrimSession | null = null;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Uygulama kökü bulunamadı.');

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
  scissors: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg>',
};

app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <div class="brand-cluster">
        <span class="publisher-name">ozguler forge</span>
        <a class="brand" href="./" aria-label="Ses Cebi ana sayfa">
          <span class="brand-mark">${icons.cassette}</span>
          <span class="brand-name">Ses Cebi</span>
        </a>
      </div>
      <div class="header-note"><span class="live-dot"></span><span>Bu cihazda, sana ait</span></div>
    </header>

    <main>
      <section class="hero" aria-labelledby="hero-title">
        <div>
          <p class="eyebrow">Kişisel ses arşivin</p>
          <h1 id="hero-title">Kaydet, kes, dinle.</h1>
          <p class="hero-copy">İzinli seslerini telefonunda sakla, çevrimdışı dinle, istediğin bölümü kırpıp indir.</p>
        </div>
        <div class="tape-illustration" aria-hidden="true">
          <div class="tape-label"><strong>SES CEBİ · KES & ÇAL</strong><span>yerel arşiv</span></div>
          <div class="tape-reel"></div>
        </div>
      </section>

      <section class="content-grid" aria-label="Ses ekleme ve arşiv">
        <div>
          <section class="card add-card" aria-labelledby="add-title">
            <div class="card-heading">
              <div><h2 id="add-title">Cebe bir ses koy</h2><p>Dosyadan seç (videodan sesi ayır) veya izinli bağlantı ekle.</p></div>
              <span class="stamp">YEREL</span>
            </div>
            <div class="tabs" role="tablist" aria-label="Ses ekleme yöntemi">
              <button class="tab active" type="button" role="tab" aria-selected="true" data-tab="file">Dosya seç</button>
              <button class="tab" type="button" role="tab" aria-selected="false" data-tab="url">Bağlantı ekle</button>
            </div>
            <div id="file-panel" role="tabpanel">
              <label class="file-drop" for="file-input">
                ${icons.upload}
                <strong>Ses veya video dosyasını seç</strong>
                <span>MP3, M4A, WAV, OGG veya MP4/MOV/WEBM video · en fazla 100 MB</span>
                <input id="file-input" type="file" accept="audio/*,video/*,.mp3,.m4a,.wav,.ogg,.aac,.flac,.mp4,.m4v,.mov,.webm,.mkv" />
              </label>
              <p class="file-name" id="file-name" aria-live="polite">Henüz dosya seçilmedi</p>
            </div>
            <div id="url-panel" class="url-panel" role="tabpanel" hidden>
              <label class="sr-only" for="url-input">Doğrudan ses dosyası bağlantısı</label>
              <input class="text-input" id="url-input" type="url" inputmode="url" placeholder="https://site.com/ses.mp3" autocomplete="off" />
              <p class="url-hint">Sadece herkese açık, doğrudan ses dosyası bağlantıları çalışır. Instagram sayfaları ve giriş gerektiren adresler desteklenmez.</p>
            </div>
            <label class="consent"><input id="consent" type="checkbox" /><span>Bu sesi kullanma ve indirme hakkına sahip olduğumu veya açıkça izin verildiğini onaylıyorum.</span></label>
            <button class="primary-button" id="add-button" type="button" disabled>${icons.plus}<span>Kasete ekle</span></button>
            <div class="progress-wrap" id="progress-wrap" aria-live="polite">
              <div class="progress-line"><span id="progress-label">Hazırlanıyor…</span><strong id="progress-value">0%</strong></div>
              <progress id="progress" max="100" value="0">0%</progress>
            </div>
          </section>

          <div class="player" id="player" aria-live="polite">
            <div class="player-top">
              <div class="player-art">${icons.cassette}</div>
              <div class="player-title"><strong id="player-title">—</strong><span id="player-subtitle">Çalmaya hazır</span></div>
            </div>
            <div class="player-controls">
              <button class="player-button small" id="back-button" type="button" aria-label="10 saniye geri sar">${icons.rewind}</button>
              <button class="player-button" id="play-button" type="button" aria-label="Oynat">${icons.play}</button>
              <button class="player-button small" id="forward-button" type="button" aria-label="10 saniye ileri sar">${icons.forward}</button>
              <input class="seek" id="seek" type="range" min="0" max="100" value="0" aria-label="Ses ilerlemesi" />
              <span class="time" id="time">00:00 / 00:00</span>
            </div>
          </div>
        </div>

        <section class="card library-card" aria-labelledby="library-title">
          <div class="library-header">
            <div><h2 id="library-title">Cebimdeki sesler</h2><span class="library-count" id="library-count">0 kayıt</span></div>
            <span class="stamp">OFFLINE</span>
          </div>
          <div class="empty-state" id="empty-state">
            <div class="empty-icon">${icons.cassette}</div>
            <h3>Arşiv henüz boş</h3>
            <p>İlk sesini eklediğinde burada, bu cihazda ve internet olmasa da görünecek.</p>
          </div>
          <div class="song-list" id="song-list"></div>
        </section>
      </section>
    </main>

    <footer class="site-footer">
      <div class="footer-intro"><strong>ozguler forge</strong><span>Ses Cebi · kişisel ses arşivin</span><span>Sesler bu cihazda saklanır; uygulama sunucusuna yüklenmez.</span></div>
      <div class="footer-contact"><a href="https://ozgulerforge.com.tr" target="_blank" rel="noreferrer">ozgulerforge.com.tr</a><a href="mailto:iletisim@ozgulerforge.com.tr">iletisim@ozgulerforge.com.tr</a></div>
      <div class="legal-grid">
        <section><h3>Kullanım ve telif</h3><p>Ses Cebi yalnızca sahip olduğunuz veya kullanma ve indirme izniniz bulunan içerikler için kullanılmalıdır. İçerik hakları ilgili sahiplerine aittir; izinsiz çoğaltma, dağıtma veya ticari kullanım kullanıcının sorumluluğundadır.</p></section>
        <section><h3>Gizlilik ve depolama</h3><p>Bu sürümde hesap oluşturulmaz. Eklediğiniz sesler tarayıcının yerel depolamasında tutulur. Tarayıcı verilerini temizlemek, uygulamayı kaldırmak veya cihaz depolamasının silinmesi kayıtların kaybolmasına neden olabilir.</p></section>
        <section><h3>Platform sınırları</h3><p>Uygulama Instagram’a giriş yapmaz; özel hesaplara, korumalı içeriğe veya platform kısıtlarını aşmaya yönelik erişim sağlamaz. Yalnızca herkese açık ve izinli doğrudan medya bağlantıları desteklenir.</p></section>
      </div>
      <p class="legal-note">Uygulamayı kullanarak yukarıdaki kullanım, telif ve depolama koşullarını kabul etmiş olursunuz. Yasal haklarınız ve yükümlülükleriniz için ilgili mevzuatı ve içerik sahibinin izin şartlarını ayrıca kontrol edin.</p>
    </footer>
  </div>

  <div class="overlay" id="trim-overlay" hidden>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="trim-title">
      <div class="sheet-head">
        <h2 id="trim-title">Sesi kes</h2>
        <button class="icon-button" id="trim-close" type="button" aria-label="Kapat">✕</button>
      </div>
      <p class="sheet-sub" id="trim-name"></p>
      <p class="sheet-status" id="trim-status" aria-live="polite" hidden></p>
      <canvas class="wave" id="wave" height="96" aria-label="Ses dalga biçimi"></canvas>
      <div class="trim-field">
        <div class="trim-label"><span>Başlangıç</span><strong id="trim-start-label">00:00.0</strong></div>
        <div class="trim-row">
          <button class="nudge" type="button" data-nudge="start" data-delta="-1">−1 sn</button>
          <input id="trim-start" type="range" min="0" max="100" step="any" value="0" aria-label="Başlangıç" />
          <button class="nudge" type="button" data-nudge="start" data-delta="1">+1 sn</button>
        </div>
      </div>
      <div class="trim-field">
        <div class="trim-label"><span>Bitiş</span><strong id="trim-end-label">00:00.0</strong></div>
        <div class="trim-row">
          <button class="nudge" type="button" data-nudge="end" data-delta="-1">−1 sn</button>
          <input id="trim-end" type="range" min="0" max="100" step="any" value="100" aria-label="Bitiş" />
          <button class="nudge" type="button" data-nudge="end" data-delta="1">+1 sn</button>
        </div>
      </div>
      <p class="sheet-sub" id="trim-summary"></p>
      <label class="consent sheet-check"><input id="trim-keep" type="checkbox" checked /><span>Orijinal ses de arşivde kalsın</span></label>
      <div class="sheet-actions">
        <button class="ghost-button" id="trim-preview" type="button" disabled>Seçimi dinle</button>
        <button class="primary-button" id="trim-save" type="button" disabled>${icons.scissors}<span>Kes ve kaydet</span></button>
      </div>
      <p class="sheet-sub small">Kesilen bölüm WAV olarak arşive kaydedilir; ardından İndir tuşuyla cihazına alabilirsin.</p>
    </div>
  </div>

  <div class="toast" id="toast" role="status"></div>
`;

function get<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(`#${selector}`);
  if (!element) throw new Error(`Eksik arayüz öğesi: ${selector}`);
  return element;
}

const fileInput = get<HTMLInputElement>('file-input');
const fileName = get<HTMLParagraphElement>('file-name');
const consent = get<HTMLInputElement>('consent');
const addButton = get<HTMLButtonElement>('add-button');
const urlInput = get<HTMLInputElement>('url-input');
const progressWrap = get<HTMLDivElement>('progress-wrap');
const progress = get<HTMLProgressElement>('progress');
const progressLabel = get<HTMLSpanElement>('progress-label');
const progressValue = get<HTMLElement>('progress-value');
const songList = get<HTMLDivElement>('song-list');
const emptyState = get<HTMLDivElement>('empty-state');
const libraryCount = get<HTMLSpanElement>('library-count');
const player = get<HTMLDivElement>('player');
const playerTitle = get<HTMLElement>('player-title');
const playerSubtitle = get<HTMLElement>('player-subtitle');
const playButton = get<HTMLButtonElement>('play-button');
const seek = get<HTMLInputElement>('seek');
const timeLabel = get<HTMLSpanElement>('time');

const trimOverlay = get<HTMLDivElement>('trim-overlay');
const trimName = get<HTMLParagraphElement>('trim-name');
const trimStatus = get<HTMLParagraphElement>('trim-status');
const waveCanvas = get<HTMLCanvasElement>('wave');
const trimStart = get<HTMLInputElement>('trim-start');
const trimEnd = get<HTMLInputElement>('trim-end');
const trimStartLabel = get<HTMLElement>('trim-start-label');
const trimEndLabel = get<HTMLElement>('trim-end-label');
const trimSummary = get<HTMLParagraphElement>('trim-summary');
const trimKeep = get<HTMLInputElement>('trim-keep');
const trimPreviewButton = get<HTMLButtonElement>('trim-preview');
const trimSaveButton = get<HTMLButtonElement>('trim-save');

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
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

async function dbGetAll(): Promise<StoredSong[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as StoredSong[]).sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error ?? new Error('Sesler okunamadı.'));
  });
}

async function dbPut(song: StoredSong): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(song);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Ses cihazda saklanamadı.'));
  });
}

async function dbDelete(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Ses silinemedi.'));
  });
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '00:00';
  const seconds = Math.floor(value);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatClock(value: number): string {
  const tenths = Math.max(0, Math.round(value * 10));
  const minutes = Math.floor(tenths / 600);
  const seconds = (tenths % 600) / 10;
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toast(message: string, error = false): void {
  const node = get<HTMLDivElement>('toast');
  window.clearTimeout(toastTimer);
  node.textContent = message;
  node.className = `toast show${error ? ' error' : ''}`;
  toastTimer = window.setTimeout(() => { node.className = 'toast'; }, 4200);
}

function setProgress(label: string, value: number, visible = true): void {
  progressWrap.classList.toggle('visible', visible);
  progressLabel.textContent = label;
  progress.value = value;
  progressValue.textContent = `${Math.round(value)}%`;
}

function updateAddButton(): void {
  const hasSource = activeTab === 'file' ? Boolean(selectedFile) : Boolean(urlInput.value.trim());
  addButton.disabled = !consent.checked || !hasSource;
}

function switchTab(tab: 'file' | 'url'): void {
  activeTab = tab;
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
    const selected = button.dataset.tab === tab;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  get<HTMLDivElement>('file-panel').hidden = tab !== 'file';
  get<HTMLDivElement>('url-panel').hidden = tab !== 'url';
  updateAddButton();
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagram.net' || host.endsWith('.instagram.net') || host.endsWith('.cdninstagram.com');
}

function validateDirectUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Geçerli bir http veya https bağlantısı gir.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Yalnızca http veya https bağlantıları kullanılabilir.');
  if (isBlockedHost(url.hostname)) {
    throw new Error('Instagram sayfaları veya korumalı medya bağlantıları desteklenmiyor. Doğrudan ve izinli bir ses dosyası bağlantısı kullan.');
  }
  return url;
}

function fileBaseName(name: string): string {
  const withoutExt = name.replace(/\.[^/.]+$/, '').trim();
  return withoutExt || 'İsimsiz ses';
}

function urlBaseName(url: URL): string {
  const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '').replace(/\.[^/.]+$/, '').trim();
  return last || 'Bağlantıdan kaydedilen ses';
}

function getDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => { const value = Number.isFinite(probe.duration) ? probe.duration : 0; URL.revokeObjectURL(url); resolve(value); };
    probe.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    probe.src = url;
  });
}

async function looksLikeAudio(blob: Blob): Promise<boolean> {
  const bytes = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  const startsWith = (value: string) => text.startsWith(value);
  const isRiffWave = startsWith('RIFF') && text.slice(8, 12) === 'WAVE';
  const isFtyp = text.slice(4, 8) === 'ftyp';
  const isMp3Frame = bytes.length > 1 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  const isWebm = bytes.length > 3 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  return startsWith('ID3') || isRiffWave || startsWith('OggS') || startsWith('fLaC') || isFtyp || isMp3Frame || isWebm;
}

async function normalizeAudioBlob(blob: Blob, declaredType: string): Promise<{ blob: Blob; type: string }> {
  const type = (blob.type || declaredType || '').toLowerCase();
  if (type.startsWith('audio/')) return { blob, type };
  if ((type === '' || type === 'application/octet-stream') && await looksLikeAudio(blob)) {
    return { blob: new Blob([blob], { type: 'audio/mpeg' }), type: 'audio/mpeg' };
  }
  throw new Error('Bu bağlantı gerçek bir ses dosyası gibi görünmüyor.');
}

async function readUrlBlob(url: URL): Promise<{ blob: Blob; type: string }> {
  let response: Response;
  try { response = await fetch(url.href, { mode: 'cors' }); } catch { throw new Error('Bağlantıya erişilemedi. Dosya herkese açık ve CORS erişimine izin veriyor olmalı.'); }
  if (!response.ok) throw new Error(`Bağlantı ses dosyasını vermedi (HTTP ${response.status}).`);
  if (isBlockedHost(new URL(response.url).hostname)) throw new Error('Bağlantı Instagram veya korumalı bir hedefe yönlendirildi.');
  const declaredType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || '';
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_SIZE) throw new Error('Bu dosya 100 MB sınırını aşıyor.');
  if (declaredType && !declaredType.startsWith('audio/') && declaredType !== 'application/octet-stream') throw new Error('Bu bağlantı bir ses dosyası gibi görünmüyor.');
  if (!response.body) {
    const blob = await response.blob();
    if (blob.size > MAX_SIZE) throw new Error('Bu dosya 100 MB sınırını aşıyor.');
    return normalizeAudioBlob(blob, declaredType);
  }
  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let received = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    if (part.value) {
      const copy = new Uint8Array(part.value.byteLength);
      copy.set(part.value);
      chunks.push(copy.buffer as ArrayBuffer);
      received += part.value.byteLength;
      if (received > MAX_SIZE) { await reader.cancel(); throw new Error('Bu dosya 100 MB sınırını aşıyor.'); }
      const percent = length ? (received / length) * 100 : Math.min(95, (received / MAX_SIZE) * 100);
      setProgress('Bağlantıdan alınıyor…', percent);
    }
  }
  const blob = new Blob(chunks, { type: declaredType || 'application/octet-stream' });
  if (!blob.size) throw new Error('Boş bir dosya alındı.');
  return normalizeAudioBlob(blob, declaredType);
}

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv)$/i;

function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || VIDEO_EXT.test(file.name);
}

function decodeAudio(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    try { ctx.decodeAudioData(data, resolve, reject)?.then?.(resolve, reject); } catch (error) { reject(error); }
  });
}

function encodeWav(buffer: AudioBuffer, from = 0, to = buffer.length): Blob {
  const channels = Math.min(2, buffer.numberOfChannels);
  const safeFrom = Math.max(0, Math.min(from, buffer.length));
  const safeTo = Math.max(safeFrom, Math.min(to, buffer.length));
  const length = safeTo - safeFrom;
  const sampleRate = buffer.sampleRate;
  const dataSize = length * channels * 2;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);
  const writeText = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  writeText(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); writeText(8, 'WAVE');
  writeText(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
  writeText(36, 'data'); view.setUint32(40, dataSize, true);
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      const sample = Math.max(-1, Math.min(1, data[c][safeFrom + i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([out], { type: 'audio/wav' });
}

async function extractAudioFromVideo(file: File): Promise<Blob> {
  setProgress('Video okunuyor…', 15);
  const data = await file.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    setProgress('Videodan ses ayrılıyor…', 40);
    decoded = await decodeAudio(ctx, data);
  } catch {
    throw new Error('Videodaki ses okunamadı. Videoda ses kanalı olmayabilir veya tarayıcın bu biçimi desteklemiyor (MP4/H.264+AAC dene).');
  } finally {
    ctx.close().catch(() => undefined);
  }
  if (!decoded.length || decoded.duration <= 0) throw new Error('Videoda ses bulunamadı.');
  setProgress('Ses dosyası hazırlanıyor…', 75);
  await new Promise((resolve) => setTimeout(resolve, 30));
  return encodeWav(decoded);
}

async function createSong(blob: Blob, name: string, source: SourceType): Promise<StoredSong> {
  const declaredType = blob.type.toLowerCase();
  const type = declaredType.startsWith('audio/') ? declaredType : (await looksLikeAudio(blob) ? 'audio/mpeg' : '');
  if (!type) throw new Error('Bu dosya gerçek bir ses içermiyor veya desteklenmiyor.');
  const normalizedBlob = type === declaredType ? blob : new Blob([blob], { type });
  const duration = await getDuration(normalizedBlob);
  if (duration <= 0) throw new Error('Ses dosyası okunamadı veya tarayıcı tarafından desteklenmiyor.');
  return { id: crypto.randomUUID(), name: fileBaseName(name), blob: normalizedBlob, type, size: normalizedBlob.size, duration, createdAt: Date.now(), source };
}

async function addSelectedAudio(): Promise<void> {
  if (!consent.checked) { toast('Devam etmek için kullanım hakkını onayla.', true); return; }
  addButton.disabled = true;
  setProgress('Hazırlanıyor…', 8);
  try {
    let blob: Blob;
    let name: string;
    const source: SourceType = activeTab;
    if (activeTab === 'file') {
      if (!selectedFile) throw new Error('Önce bir ses veya video dosyası seç.');
      const isVideo = isVideoFile(selectedFile);
      if (!isVideo && !selectedFile.type.startsWith('audio/') && !/\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(selectedFile.name)) throw new Error('Bu dosya desteklenen bir ses veya video formatında değil.');
      if (selectedFile.size > MAX_SIZE) throw new Error('Bu dosya 100 MB sınırını aşıyor.');
      name = selectedFile.name;
      blob = isVideo ? await extractAudioFromVideo(selectedFile) : selectedFile;
      setProgress('Cihaza kaydediliyor…', 90);
    } else {
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
  } catch (error) {
    setProgress('', 0, false);
    toast(error instanceof Error ? error.message : 'Ses eklenirken beklenmeyen bir sorun oluştu.', true);
  } finally {
    updateAddButton();
  }
}

function resetSource(): void {
  selectedFile = null;
  fileInput.value = '';
  fileName.textContent = 'Henüz dosya seçilmedi';
  urlInput.value = '';
  consent.checked = false;
  updateAddButton();
}

function sourceLabel(source: SourceType): string {
  if (source === 'url') return 'İzinli bağlantı';
  if (source === 'trim') return 'Kesit';
  return 'Dosya';
}

function renderLibrary(): void {
  libraryCount.textContent = `${songs.length} kayıt`;
  emptyState.hidden = songs.length > 0;
  songList.innerHTML = songs.map((song) => `
    <article class="song-row" data-song-id="${song.id}">
      <div class="song-art">${icons.cassette}</div>
      <div class="song-main">
        <p class="song-name" title="${escapeHtml(song.name)}">${escapeHtml(song.name)}</p>
        <div class="song-meta">
          <span>${formatTime(song.duration)}</span>
          <span>·</span>
          <span>${formatSize(song.size)}</span>
          <span>·</span>
          <span class="status-pill">Cihazda</span>
        </div>
      </div>
      <div class="song-actions">
        <button class="icon-button play-row" type="button" aria-label="${activeSong?.id === song.id && !audio.paused ? 'Duraklat' : 'Oynat'}: ${escapeHtml(song.name)}">${activeSong?.id === song.id && !audio.paused ? icons.pause : icons.play}</button>
        <button class="icon-button trim-row" type="button" aria-label="Kes: ${escapeHtml(song.name)}" title="Sesi kes">${icons.scissors}</button>
        <button class="icon-button download-row" type="button" aria-label="İndir: ${escapeHtml(song.name)}" title="İndir">${icons.download}</button>
        <button class="icon-button danger delete-row" type="button" aria-label="Sil: ${escapeHtml(song.name)}" title="Sil">${icons.trash}</button>
      </div>
    </article>`).join('');

  songList.querySelectorAll<HTMLElement>('.song-row').forEach((row) => {
    const id = row.dataset.songId;
    const song = songs.find((item) => item.id === id);
    if (!song) return;
    row.querySelector<HTMLButtonElement>('.play-row')?.addEventListener('click', () => void toggleSong(song));
    row.querySelector<HTMLButtonElement>('.trim-row')?.addEventListener('click', () => void openTrim(song));
    row.querySelector<HTMLButtonElement>('.download-row')?.addEventListener('click', () => downloadSong(song));
    row.querySelector<HTMLButtonElement>('.delete-row')?.addEventListener('click', () => void deleteSong(song));
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character));
}

function loadSong(song: StoredSong): void {
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  activeObjectUrl = URL.createObjectURL(song.blob);
  activeSong = song;
  audio.src = activeObjectUrl;
  audio.load();
  player.classList.add('visible');
  playerTitle.textContent = song.name;
  playerSubtitle.textContent = `${sourceLabel(song.source)} · cihazda saklanıyor`;
  seek.value = '0';
  updatePlayerUI();
}

async function toggleSong(song: StoredSong): Promise<void> {
  if (activeSong?.id !== song.id) loadSong(song);
  if (audio.paused) {
    try { await audio.play(); } catch { toast('Bu ses tarayıcıda oynatılamadı.', true); }
  } else audio.pause();
  renderLibrary();
  updatePlayerUI();
}

function updatePlayerUI(): void {
  if (!activeSong) return;
  playButton.innerHTML = audio.paused ? icons.play : icons.pause;
  playButton.setAttribute('aria-label', audio.paused ? 'Oynat' : 'Duraklat');
  const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : activeSong.duration;
  const current = audio.currentTime || 0;
  seek.max = String(duration || 100);
  seek.value = String(current);
  timeLabel.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  playerSubtitle.textContent = audio.paused ? 'Duraklatıldı · cihazda saklı' : 'Şimdi çalıyor · cihazda saklı';
}

function downloadSong(song: StoredSong): void {
  const url = URL.createObjectURL(song.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${song.name || 'ses'}.${extensionFor(song.type)}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Ses dosyası indirilmeye hazır.');
}

function extensionFor(type: string): string {
  const map: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/aac': 'aac', 'audio/flac': 'flac', 'audio/webm': 'webm' };
  return map[type] || 'audio';
}

async function deleteSong(song: StoredSong): Promise<void> {
  if (!window.confirm(`“${song.name}” arşivden silinsin mi?`)) return;
  await removeSong(song);
}

async function removeSong(song: StoredSong): Promise<void> {
  try {
    await dbDelete(song.id);
    songs = songs.filter((item) => item.id !== song.id);
    if (activeSong?.id === song.id) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = ''; }
      activeSong = null;
      player.classList.remove('visible');
    }
    renderLibrary();
    toast('Ses arşivden silindi.');
  } catch {
    toast('Ses silinemedi; cihaz depolamasını kontrol et.', true);
  }
}

function openOverlay(node: HTMLElement): void {
  node.hidden = false;
  document.body.classList.add('modal-open');
}

function closeOverlay(node: HTMLElement): void {
  node.hidden = true;
  if (trimOverlay.hidden) document.body.classList.remove('modal-open');
}

function computePeaks(buffer: AudioBuffer, buckets: number): Float32Array {
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
        if (value > max) max = value;
      }
      if (max > peaks[b]) peaks[b] = max;
    }
  }
  return peaks;
}

function drawWave(): void {
  const s = trimState;
  if (!s || !s.peaks || !s.buffer) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(200, Math.round(waveCanvas.clientWidth * dpr));
  const h = Math.round(96 * dpr);
  if (waveCanvas.width !== w) waveCanvas.width = w;
  if (waveCanvas.height !== h) waveCanvas.height = h;
  const g = waveCanvas.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, w, h);
  const duration = s.buffer.duration;
  const x0 = (s.start / duration) * w;
  const x1 = (s.end / duration) * w;
  const n = s.peaks.length;
  const step = Math.max(2, Math.round(3 * dpr));
  const barWidth = Math.max(1, Math.round(2 * dpr));
  for (let x = 0; x < w; x += step) {
    const peak = s.peaks[Math.min(n - 1, Math.floor((x / w) * n))];
    const bar = Math.max(2 * dpr, peak * (h - 8 * dpr));
    g.fillStyle = x >= x0 && x <= x1 ? '#d95d39' : '#cdbdab';
    g.fillRect(x, (h - bar) / 2, barWidth, bar);
  }
  if (s.playhead >= 0) {
    g.fillStyle = '#211b18';
    g.fillRect(Math.round((s.playhead / duration) * w), 0, Math.max(1, Math.round(2 * dpr)), h);
  }
}

function setTrimBusy(busy: boolean, text = ''): void {
  trimStatus.textContent = text;
  trimStatus.hidden = !text;
  trimStart.disabled = busy;
  trimEnd.disabled = busy;
  trimPreviewButton.disabled = busy;
  trimSaveButton.disabled = busy;
  trimOverlay.querySelectorAll<HTMLButtonElement>('.nudge').forEach((button) => { button.disabled = busy; });
}

function syncTrim(changed?: 'start' | 'end'): void {
  const s = trimState;
  if (!s || !s.buffer) return;
  const duration = s.buffer.duration;
  let start = Number(trimStart.value);
  let end = Number(trimEnd.value);
  if (changed === 'start' && start > end - MIN_CLIP) start = Math.max(0, end - MIN_CLIP);
  if (changed === 'end' && end < start + MIN_CLIP) end = Math.min(duration, start + MIN_CLIP);
  s.start = start;
  s.end = end;
  trimStart.value = String(start);
  trimEnd.value = String(end);
  trimStartLabel.textContent = formatClock(start);
  trimEndLabel.textContent = formatClock(end);
  const length = Math.max(0, end - start);
  const bytes = Math.round(length * s.buffer.sampleRate) * Math.min(2, s.buffer.numberOfChannels) * 2 + 44;
  trimSummary.textContent = `Seçili süre: ${formatClock(length)} · yaklaşık ${formatSize(bytes)}`;
  drawWave();
}

async function openTrim(song: StoredSong): Promise<void> {
  if (song.duration > MAX_TRIM_SECONDS) {
    toast(`Kesme en çok ${MAX_TRIM_SECONDS / 60} dakikalık seslerde çalışır.`, true);
    return;
  }
  audio.pause();
  closeTrim();
  const state: TrimSession = { song, buffer: null, peaks: null, start: 0, end: song.duration, preview: null, previewUrl: '', playhead: -1 };
  trimState = state;
  trimName.textContent = song.name;
  trimSummary.textContent = '';
  trimStartLabel.textContent = formatClock(0);
  trimEndLabel.textContent = formatClock(song.duration);
  setTrimBusy(true, 'Ses çözülüyor…');
  openOverlay(trimOverlay);
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const buffer = await decodeAudio(ctx, await song.blob.arrayBuffer());
    if (trimState !== state) return;
    if (!buffer.length || buffer.duration <= 0) throw new Error('empty');
    state.buffer = buffer;
    state.peaks = computePeaks(buffer, 400);
    state.start = 0;
    state.end = buffer.duration;
    trimStart.max = String(buffer.duration);
    trimEnd.max = String(buffer.duration);
    trimStart.value = '0';
    trimEnd.value = String(buffer.duration);
    trimKeep.checked = true;
    setTrimBusy(false);
    trimPreviewButton.textContent = 'Seçimi dinle';
    syncTrim();
  } catch {
    if (trimState === state) {
      closeTrim();
      toast('Bu ses tarayıcıda çözülemedi, kesilemiyor.', true);
    }
  } finally {
    ctx.close().catch(() => undefined);
  }
}

function closeTrim(): void {
  const s = trimState;
  if (s?.preview) {
    s.preview.pause();
    s.preview.removeAttribute('src');
    s.preview.load();
  }
  if (s?.previewUrl) URL.revokeObjectURL(s.previewUrl);
  trimState = null;
  closeOverlay(trimOverlay);
}

function stopTrimPreview(): void {
  const s = trimState;
  if (!s?.preview) return;
  s.preview.pause();
  s.playhead = -1;
  trimPreviewButton.textContent = 'Seçimi dinle';
  drawWave();
}

function toggleTrimPreview(): void {
  const s = trimState;
  if (!s?.buffer) return;
  if (s.preview && !s.preview.paused) {
    stopTrimPreview();
    return;
  }
  if (!s.preview) {
    s.previewUrl = URL.createObjectURL(s.song.blob);
    const preview = new Audio(s.previewUrl);
    preview.addEventListener('timeupdate', () => {
      s.playhead = preview.currentTime;
      if (preview.currentTime >= s.end) stopTrimPreview();
      else drawWave();
    });
    preview.addEventListener('ended', stopTrimPreview);
    s.preview = preview;
  }
  const preview = s.preview;
  const begin = () => {
    preview.currentTime = s.start;
    preview.play().then(() => { trimPreviewButton.textContent = 'Durdur'; }).catch(() => toast('Önizleme çalınamadı.', true));
  };
  if (preview.readyState >= 1) begin();
  else {
    preview.addEventListener('loadedmetadata', begin, { once: true });
    preview.load();
  }
}

async function saveTrim(): Promise<void> {
  const s = trimState;
  if (!s?.buffer) return;
  stopTrimPreview();
  setTrimBusy(true, 'Kesit hazırlanıyor…');
  try {
    const rate = s.buffer.sampleRate;
    const from = Math.max(0, Math.floor(s.start * rate));
    const to = Math.min(s.buffer.length, Math.ceil(s.end * rate));
    if (to - from < rate * MIN_CLIP * 0.5) throw new Error('Seçilen bölüm çok kısa.');
    await new Promise((resolve) => setTimeout(resolve, 30));
    const clip = await createSong(encodeWav(s.buffer, from, to), `${s.song.name} (kesit)`, 'trim');
    await dbPut(clip);
    songs = [clip, ...songs];
    const keep = trimKeep.checked;
    const original = s.song;
    closeTrim();
    if (!keep) await removeSong(original);
    renderLibrary();
    toast(keep ? 'Kesit yeni kayıt olarak eklendi.' : 'Kesit kaydedildi, orijinal silindi.');
  } catch (error) {
    if (trimState === s) setTrimBusy(false);
    toast(error instanceof Error ? error.message : 'Kesit kaydedilemedi.', true);
  }
}

function dismissSplash(): void {
  const splash = document.querySelector<HTMLDivElement>('#splash');
  if (!splash) return;
  window.setTimeout(() => {
    splash.classList.add('hide');
    window.setTimeout(() => splash.remove(), 500);
  }, 650);
}

fileInput.addEventListener('change', () => {
  selectedFile = fileInput.files?.[0] || null;
  fileName.textContent = selectedFile ? `${selectedFile.name} · ${formatSize(selectedFile.size)}` : 'Henüz dosya seçilmedi';
  updateAddButton();
});
consent.addEventListener('change', updateAddButton);
urlInput.addEventListener('input', updateAddButton);
addButton.addEventListener('click', () => void addSelectedAudio());
document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
  button.addEventListener('click', () => switchTab(button.dataset.tab === 'url' ? 'url' : 'file'));
});

playButton.addEventListener('click', async () => {
  if (!activeSong) return;
  if (audio.paused) {
    try { await audio.play(); } catch { toast('Bu ses tarayıcıda oynatılamadı.', true); }
  } else audio.pause();
  updatePlayerUI();
  renderLibrary();
});
get<HTMLButtonElement>('back-button').addEventListener('click', () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
get<HTMLButtonElement>('forward-button').addEventListener('click', () => { audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 10); });
seek.addEventListener('input', () => { audio.currentTime = Number(seek.value); updatePlayerUI(); });
audio.addEventListener('timeupdate', updatePlayerUI);
audio.addEventListener('loadedmetadata', updatePlayerUI);
audio.addEventListener('play', () => { updatePlayerUI(); renderLibrary(); });
audio.addEventListener('pause', () => { updatePlayerUI(); renderLibrary(); });
audio.addEventListener('ended', () => { updatePlayerUI(); renderLibrary(); });

trimStart.addEventListener('input', () => syncTrim('start'));
trimEnd.addEventListener('input', () => syncTrim('end'));
trimOverlay.querySelectorAll<HTMLButtonElement>('.nudge').forEach((button) => {
  button.addEventListener('click', () => {
    const s = trimState;
    if (!s?.buffer) return;
    const which = button.dataset.nudge === 'end' ? 'end' : 'start';
    const input = which === 'start' ? trimStart : trimEnd;
    input.value = String(Math.min(s.buffer.duration, Math.max(0, Number(input.value) + Number(button.dataset.delta))));
    syncTrim(which);
  });
});
waveCanvas.addEventListener('pointerdown', (event) => {
  const s = trimState;
  if (!s?.buffer) return;
  const rect = waveCanvas.getBoundingClientRect();
  const time = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * s.buffer.duration;
  const which = Math.abs(time - s.start) <= Math.abs(time - s.end) ? 'start' : 'end';
  (which === 'start' ? trimStart : trimEnd).value = String(time);
  syncTrim(which);
});
trimPreviewButton.addEventListener('click', toggleTrimPreview);
trimSaveButton.addEventListener('click', () => void saveTrim());
get<HTMLButtonElement>('trim-close').addEventListener('click', closeTrim);
trimOverlay.addEventListener('click', (event) => { if (event.target === trimOverlay) closeTrim(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !trimOverlay.hidden) closeTrim(); });
window.addEventListener('resize', drawWave);

async function init(): Promise<void> {
  dismissSplash();
  if (navigator.storage?.persist) {
    try { await navigator.storage.persist(); } catch { /* Tarayıcı kalıcılığı reddedebilir; uygulama çalışmaya devam eder. */ }
  }
  try {
    songs = await dbGetAll();
    renderLibrary();
  } catch { toast('Yerel arşiv başlatılamadı. Tarayıcı depolama iznini kontrol et.', true); }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js?v=8', { scope: './' }).catch(() => undefined);
}

void init();
