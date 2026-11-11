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
      <div class="header-note"><span class="live-dot"></span><span>Bu cihazda, sana ait</span></div>
    </header>

    <main>
      <section class="hero" aria-labelledby="hero-title">
        <div>
          <p class="eyebrow">Kişisel ses arşivin</p>
          <h1 id="hero-title">Cep kasetlerin burada.</h1>
          <p class="hero-copy">İzinli seslerini telefonunda sakla, çevrimdışı dinle. Küçük bir arşiv, her an yanında.</p>
        </div>
        <div class="tape-illustration" aria-hidden="true">
          <div class="tape-label"><strong>PLAY / REW</strong><span>seslerim · 01</span></div>
          <div class="tape-reel"></div>
        </div>
      </section>

      <section class="app-card" aria-label="Uygulama kurulumu ve güncelleme">
        <div class="app-card-text"><strong>Uygulama</strong><span id="app-status" aria-live="polite">Sürüm 12</span></div>
        <div class="app-card-actions">
          <button class="primary-button install-button" id="install-button" type="button">${icons.download}<span>Yükle</span></button>
          <button class="ghost-button" id="update-button" type="button"><span>Güncellemeleri denetle</span></button>
          <button class="ghost-button" id="diag-button" type="button"><span>Kurulum durumu</span></button>
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
            <div class="progress-wrap" id="progress-wrap" aria-live="polite"><div class="progress-line"><span id="progress-label">Hazırlanıyor…</span><strong id="progress-value">0%</strong></div><progress id="progress" max="100" value="0">0%</progress></div>
          </section>
          <div class="player" id="player" aria-live="polite">
            <div class="player-top"><div class="player-art">${icons.cassette}</div><div class="player-title"><strong id="player-title">—</strong><span id="player-subtitle">Çalmaya hazır</span></div></div>
            <div class="player-controls"><button class="player-button small" id="back-button" type="button" aria-label="10 saniye geri sar">${icons.rewind}</button><button class="player-button" id="play-button" type="button" aria-label="Oynat">${icons.play}</button><button class="player-button small" id="forward-button" type="button" aria-label="10 saniye ileri sar">${icons.forward}</button><input class="seek" id="seek" type="range" min="0" max="100" value="0" aria-label="Ses ilerlemesi" /><span class="time" id="time">00:00 / 00:00</span></div>
          </div>
        </div>

        <section class="card library-card" aria-labelledby="library-title">
          <div class="library-header"><div><h2 id="library-title">Cebimdeki sesler</h2><span class="library-count" id="library-count">0 kayıt</span></div><span class="stamp">OFFLINE</span></div>
          <div class="empty-state" id="empty-state"><div class="empty-icon">${icons.cassette}</div><h3>Arşiv henüz boş</h3><p>İlk sesini eklediğinde burada, bu cihazda ve internet olmasa da görünecek.</p></div>
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
  <div class="toast" id="toast" role="status"></div>
`;
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
function encodeWav(buffer) {
    const channels = Math.min(2, buffer.numberOfChannels);
    const length = buffer.length;
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
            const sample = Math.max(-1, Math.min(1, data[c][i]));
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
                blob = await extractAudioFromVideo(selectedFile);
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
    libraryCount.textContent = `${songs.length} kayıt`;
    emptyState.hidden = songs.length > 0;
    songList.innerHTML = songs.map((song) => `
    <article class="song-row" data-song-id="${song.id}">
      <div class="song-art">${icons.cassette}</div>
      <div class="song-main"><p class="song-name" title="${escapeHtml(song.name)}">${escapeHtml(song.name)}</p><div class="song-meta"><span>${formatTime(song.duration)}</span><span>·</span><span>${formatSize(song.size)}</span><span>·</span><span class="status-pill">Cihazda</span></div></div>
      <div class="song-actions"><button class="icon-button play-row" type="button" aria-label="${activeSong?.id === song.id && !audio.paused ? 'Duraklat' : 'Oynat'}: ${escapeHtml(song.name)}">${activeSong?.id === song.id && !audio.paused ? icons.pause : icons.play}</button><button class="icon-button download-row" type="button" aria-label="İndir: ${escapeHtml(song.name)}">${icons.download}</button><button class="icon-button danger delete-row" type="button" aria-label="Sil: ${escapeHtml(song.name)}">${icons.trash}</button></div>
    </article>`).join('');
    songList.querySelectorAll('.song-row').forEach((row) => {
        const id = row.dataset.songId;
        const song = songs.find((item) => item.id === id);
        if (!song)
            return;
        row.querySelector('.play-row')?.addEventListener('click', () => toggleSong(song));
        row.querySelector('.download-row')?.addEventListener('click', () => downloadSong(song));
        row.querySelector('.delete-row')?.addEventListener('click', () => deleteSong(song));
    });
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
    playerSubtitle.textContent = `${song.source === 'url' ? 'İzinli bağlantı' : 'Dosya'} · cihazda saklanıyor`;
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
    playerSubtitle.textContent = audio.paused ? 'Duraklatıldı · cihazda saklı' : 'Şimdi çalıyor · cihazda saklı';
}
function downloadSong(song) {
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
function extensionFor(type) {
    const map = { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/aac': 'aac', 'audio/flac': 'flac' };
    return map[type] || 'audio';
}
async function deleteSong(song) {
    if (!window.confirm(`“${song.name}” arşivden silinsin mi?`))
        return;
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
audio.addEventListener('play', () => { updatePlayerUI(); renderLibrary(); });
audio.addEventListener('pause', () => { updatePlayerUI(); renderLibrary(); });
audio.addEventListener('ended', () => { updatePlayerUI(); renderLibrary(); });
const APP_VERSION = '12';
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
        navigator.serviceWorker.register('./sw.js?v=12', { scope: './' }).then((registration) => { swRegistration = registration; }).catch(() => undefined);
}
void init();
