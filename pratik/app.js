import qrcode from './qrcode.mjs';

const TOOLS = [
  { id: 'metadata', group: 'Görsel', label: 'Metadata Temizle', desc: 'Yeni kopyadan EXIF ve konum bilgisini kaldır', icon: '⌁', kind: 'image', accept: 'image/*,.heic', badge: 'Gizlilik', tip: 'Görseli yeniden dışa aktararak EXIF, GPS ve cihaz bilgisini taşıyan başlıkları temizleyen yeni bir kopya oluşturur; bu sürüm başlıkları ayrıca listelemez.' },
  { id: 'compress', group: 'Görsel', label: 'Boyut Küçült', desc: '50 KB / 100 KB hedefi veya kalite', icon: '↘', kind: 'image', accept: 'image/*,.heic', badge: 'Sık kullanılan', tip: 'Kaliteyi ve piksel boyutunu kademeli ayarlar. Hedef boyut her görsel için garanti edilemez; sonuçta hedefin yakalanıp yakalanmadığı açıkça belirtilir.' },
  { id: 'heic', group: 'Görsel', label: 'HEIC → JPG', desc: 'iPhone fotoğraflarını çevir', icon: '◌', kind: 'image', accept: 'image/*,.heic', tip: 'Tarayıcı HEIC açmayı destekliyorsa JPG çıktısı alır. Destek yoksa fotoğrafı önce cihazında JPG olarak kaydedebilirsin.' },
  { id: 'convert', group: 'Görsel', label: 'Format Dönüştür', desc: 'PNG, JPG ve WebP arası', icon: '⇄', kind: 'image', accept: 'image/*,.heic', tip: 'PNG, JPG veya WebP arasında seçim yap; dönüştürme tamamen Canvas üzerinde gerçekleşir.' },
  { id: 'background', group: 'Görsel', label: 'Arka Plan Sil', desc: 'Düz arka planı basitçe şeffaflaştır', icon: '✦', kind: 'image', accept: 'image/*', tip: 'Basit ve temiz arka planlarda köşe rengine göre şeffaflaştırma uygular. Karmaşık kesimler için sonraki WASM motoru planlanıyor.' },
  { id: 'blur', group: 'Görsel', label: 'Yüz / Plaka Gizle', desc: 'Merkez, üst veya alt bölgeyi kapat', icon: '▦', kind: 'image', accept: 'image/*', tip: 'Bu araç yüz/plakayı otomatik algılamaz; seçtiğin yaklaşık merkez, üst veya alt alanı bulanıklaştırır, pikselleştirir ya da blokla kapatır. Hassas bölgeyi çıktıdan sonra kontrol et.' },
  { id: 'portrait', group: 'Görsel', label: 'Vesikalık Fotoğraf', desc: '35×45 veya 50×60 oranında kırp', icon: '▣', kind: 'image', accept: 'image/*', tip: 'Görseli seçtiğin orana göre merkezden kırpar. Resmî biyometrik gereklilikleri, baskı DPI değerini veya baş/omuz konumunu doğrulamaz.' },
  { id: 'resize', group: 'Görsel', label: 'Boyutlandır', desc: 'Piksel genişliği, yüksekliği ve oran', icon: '⤢', kind: 'image', accept: 'image/*', tip: 'İstediğin piksel genişliği ve yüksekliğinde yeni bir kopya hazırlar; oranı koruma seçeneği açıktır.' },
  { id: 'audio', group: 'Video', label: 'Videodan MP3', desc: 'Sesi ayır, MP3 ya da kayıpsız', icon: '♫', kind: 'video', accept: 'video/*', tip: 'Video motoru için yerel işlem alanını hazırlar. Tarayıcı desteğine göre ses akışını cihazında ayırır.' },
  { id: 'video-compress', group: 'Video', label: 'Video Sıkıştır', desc: 'WhatsApp ve e-posta boyutuna indir', icon: '▤', kind: 'video', accept: 'video/*', tip: 'Hedef profili seçerek cihaz içi video motoruna gönderir; dosya sunucuya yüklenmez.' },
  { id: 'trim', group: 'Video', label: 'Video Kırp', desc: 'İstediğin bölümü kayıpsız kes', icon: '⌑', kind: 'video', accept: 'video/*', tip: 'Başlangıç ve bitiş zamanlarını belirlemek için çalışma alanını açar.' },
  { id: 'gif', group: 'Video', label: 'Video → GIF', desc: 'Kısa bölümü hareketli GIF yap', icon: 'GIF', kind: 'video', accept: 'video/*', tip: 'Kısa klibi animasyonlu GIF’e dönüştürmek için yerel video akışını hazırlar.' },
  { id: 'frame', group: 'Video', label: 'Kare Yakala', desc: 'Videodan tam çözünürlükte fotoğraf', icon: '▧', kind: 'video', accept: 'video/*', tip: 'Videodan seçtiğin saniyedeki kareyi Canvas’a alır ve PNG olarak indirebileceğin bir görüntü üretir.' },
  { id: 'video-meta', group: 'Video', label: 'Video Konum Sil', desc: 'GPS ve cihaz bilgisini kayıpsız temizle', icon: '⌖', kind: 'video', accept: 'video/*', tip: 'Videonun güvenli bir çalışma kopyasını oluşturmak için cihaz içi işleme alanını açar.' },
  { id: 'qr', group: 'Diğer', label: 'QR Kod Oluştur', desc: 'Metin veya bağlantıdan taranabilir QR', icon: '▦', kind: 'qr', accept: '', tip: 'Yazdığın metin veya bağlantıyı standart QR kod olarak cihazında üretir. Wi-Fi/telefon için gerekiyorsa ilgili standart metin biçimini kendin girmelisin.' },
  { id: 'pdf-merge', group: 'PDF', label: 'PDF Birleştir', desc: 'Birden fazla PDF’i tek dosya yap', icon: '⊞', kind: 'pdf', accept: 'application/pdf,.pdf', tip: 'Birden fazla belgeyi sıraya alır. PDF motoru hazır olduğunda tek dosya olarak dışa aktarılır.' },
  { id: 'pdf-split', group: 'PDF', label: 'PDF Böl', desc: 'Sayfa seç, ayır ya da sil', icon: '⌗', kind: 'pdf', accept: 'application/pdf,.pdf', tip: 'Sayfa aralığını seçip ayrı bir belgeye dönüştürmek için çalışma alanı sağlar.' },
  { id: 'pdf-jpg', group: 'PDF', label: 'PDF → JPG', desc: 'Sayfaları görsele çevir', icon: '▤', kind: 'pdf', accept: 'application/pdf,.pdf', tip: 'PDF sayfalarını görsel olarak dışa aktarmak için yerel PDF alanını hazırlar.' },
  { id: 'jpg-pdf', group: 'PDF', label: 'JPG → PDF', desc: 'Fotoğraflardan PDF üret', icon: '▥', kind: 'pdf', accept: 'image/*', tip: 'Fotoğrafları sayfa sırasına alıp tek bir PDF dosyasına dönüştürmek için kullanılır.' },
  { id: 'pdf-sign', group: 'PDF', label: 'PDF İmzala', desc: 'Belgeye el yazısı imza ekle', icon: '✎', kind: 'pdf', accept: 'application/pdf,.pdf', tip: 'Belgeye imza çizmek için imza alanını açar; imza verisi cihazında tutulur.' }
];

const GROUPS = ['Tümü', 'Görsel', 'Video', 'Diğer', 'PDF'];
const STORAGE_KEY = 'pratik-state-v1';
const SITE_URL = 'https://ozgulerforge.com.tr';
const CONTACT_EMAIL = 'iletisim@ozgulerforge.com.tr';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { saved = {}; }
const state = {
  view: 'home',
  activeTool: null,
  legalPage: null,
  filter: 'Tümü',
  query: '',
  files: [],
  result: null,
  history: Array.isArray(saved.history) ? saved.history : [],
  operationCount: Number.isFinite(Number(saved.operationCount)) ? Number(saved.operationCount) : 0,
  theme: saved.theme || 'light'
};
let deferredInstallPrompt = null;

const root = document.getElementById('viewRoot');
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const getTool = (id) => TOOLS.find((tool) => tool.id === id);
const isToolAvailable = (tool) => tool.kind === 'image' || tool.kind === 'qr' || tool.id === 'frame' || tool.id === 'jpg-pdf';
const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
};
const baseName = (name) => name.replace(/\.[^/.]+$/, '');
const persist = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ history: state.history.slice(0, 30), operationCount: state.operationCount, theme: state.theme })); } catch { /* Storage can be disabled or full; the current session still works. */ } };
const currentHash = () => location.hash.replace(/^#/, '') || 'home';

function saveTheme() {
  document.documentElement.dataset.theme = state.theme;
  persist();
}

function toolCard(tool) {
  const num = String(TOOLS.indexOf(tool) + 1).padStart(2, '0');
  const style = tool.group === 'Video' ? '--tool-bg:#fff1d7;--tool-color:#9a6a11' : tool.group === 'PDF' ? '--tool-bg:#ffe2df;--tool-color:#aa5148' : tool.group === 'Diğer' ? '--tool-bg:#e4e0ff;--tool-color:#6559a6' : '';
  return `<button class="tool-card" style="${style}" data-tool="${tool.id}" data-num="${num}"><span class="tool-symbol">${esc(tool.icon)}</span><b>${esc(tool.label)}</b>${!isToolAvailable(tool) ? '<span class="tool-status">Yakında</span>' : ''}<small>${esc(tool.desc)}</small></button>`;
}

function renderHome() {
  const featured = getTool('metadata');
  const recent = state.history.slice(0, 3).map((entry) => getTool(entry.toolId)).filter(Boolean);
  const recentHtml = recent.length ? `<div class="recent-strip"><div class="section-head"><div><h2>Tekrar kullan</h2><p>Son açtığın araçlar burada.</p></div></div><div class="tool-grid">${recent.map(toolCard).join('')}</div></div>` : '';
  return `<section class="home-page">
    <div class="eyebrow">Kişisel dosya atölyen</div>
    <div class="home-hero">
      <div class="hero-copy"><div class="eyebrow">Pratik ile tanış</div><h1 class="page-title">Dosyanın kontrolü<br><span class="accent-text">sende kalsın.</span></h1><p class="page-lede">Desteklenen fotoğraf ve QR işlemlerini; ayrıca videodan kare yakalamayı cihazında yap. Diğer video ve PDF araçları hazırlanıyor.</p><div class="trust-row"><span class="trust-pill"><b>✓</b> Dosya yüklenmez</span><span class="trust-pill"><b>◷</b> Çevrimdışı</span><span class="trust-pill"><b>₺</b> Ücretsiz</span></div></div>
      <div class="hero-scan"><div class="scan-top"><span>GİZLİLİK DURUMU</span><strong>AKTİF</strong></div><div class="scan-lock">⌁</div><div class="scan-copy"><b>Dosyan burada kalır.</b><small>İşlemler cihazının tarayıcısında gerçekleşir. Biz dosyanı görmeyiz.</small></div></div>
    </div>
    <div class="quick-bar"><label class="search-box"><span>⌕</span><input id="homeSearch" type="search" value="${esc(state.query)}" placeholder="Bir araç ara…" autocomplete="off"></label><button class="quick-action" data-tool="metadata"><span class="quick-icon">⌁</span><span><b>Metadata temizle</b><small>En çok kullanılan</small></span></button><button class="quick-action" data-tool="compress"><span class="quick-icon">↘</span><span><b>Boyut küçült</b><small>Paylaşmaya hazırla</small></span></button><button class="quick-action" data-tool="qr"><span class="quick-icon">▦</span><span><b>QR oluştur</b><small>Hızlı paylaş</small></span></button></div>
    ${state.query ? `<div class="category-block"><div class="section-head"><div><h2>Arama sonuçları</h2><p>“${esc(state.query)}” için ${filteredTools().length} araç bulundu.</p></div></div><div class="tool-grid">${filteredTools().map(toolCard).join('') || '<div class="empty-state">Aradığın araç bulunamadı.</div>'}</div></div>` : ''}
    ${recentHtml}
    <section class="category-block"><div class="section-head"><div><h2>Görsel</h2><p>Fotoğrafını paylaşmadan önce hazırla.</p></div><button class="link-button" data-view="tools" data-filter="Görsel">Tümünü gör →</button></div><div class="tool-grid">${TOOLS.filter((tool) => tool.group === 'Görsel').map(toolCard).join('')}</div></section>
    <section class="category-block"><div class="section-head"><div><h2>Video</h2><p>Videodan kare yakala; diğer video araçları hazırlanıyor.</p></div><button class="link-button" data-view="tools" data-filter="Video">Tümünü gör →</button></div><div class="tool-grid">${TOOLS.filter((tool) => tool.group === 'Video').map(toolCard).join('')}</div></section>
    <section class="category-block"><div class="section-head"><div><h2>Diğer & PDF</h2><p>Belge ve hızlı paylaşım araçları.</p></div><button class="link-button" data-view="tools" data-filter="PDF">PDF araçları →</button></div><div class="tool-grid">${TOOLS.filter((tool) => tool.group === 'Diğer' || tool.group === 'PDF').map(toolCard).join('')}</div></section>
    <div class="home-bottom"><article class="info-panel accent"><h3>Bir kez aç, her yerde kullan.</h3><p>Pratik’i telefonunun ana ekranına eklediğinde bağlantın olmasa bile uygulama kabuğu ve son kullandığın alanlar yanında kalır.</p></article><article class="info-panel"><h3>Hızlı ve şeffaf.</h3><p>Üyelik, reklam ağı, takip kodu ve çerez yok. Sadece seçtiğin dosya ve istediğin çıktı var.</p></article></div>
    <section class="faq"><div class="eyebrow">Aklında olsun</div><h2>Güvenli çalışma hakkında</h2><details><summary>Dosyalarım gerçekten yüklenmiyor mu?</summary><p>Evet. İşleme alanları File API ve Canvas gibi cihaz içi tarayıcı yetenekleriyle çalışır. Dosya seçimi bir sunucu isteğine dönüşmez.</p></details><details><summary>Telefonumda çalışır mı?</summary><p>Evet. Pratik mobil tarayıcılar ve PWA kurulumu için tasarlandı. Büyük videolarda işlem hızı telefonunun işlemcisine bağlıdır.</p></details><details><summary>Dosyalarım saklanıyor mu?</summary><p>Hayır. Geçmişte yalnızca araç adı, dosya adı ve zaman tutulur; dosyanın içeriği veya kendisi saklanmaz.</p></details></section>
    ${renderLegalFooter()}</section>`;
}

function filteredTools() {
  const query = state.query.trim().toLocaleLowerCase('tr-TR');
  return TOOLS.filter((tool) => (!query || `${tool.label} ${tool.desc} ${tool.group}`.toLocaleLowerCase('tr-TR').includes(query)) && (state.filter === 'Tümü' || tool.group === state.filter));
}

function renderTools() {
  const tools = filteredTools();
  const grouped = GROUPS.slice(1).map((group) => `<section class="category-block"><div class="section-head"><div><h2>${group}</h2><p>${group === 'Görsel' ? 'Fotoğrafları güvenle düzenle.' : group === 'Video' ? 'Videodan istediğini çıkar.' : group === 'Diğer' ? 'Hızlı paylaşım araçları.' : 'Belge akışını tamamla.'}</p></div></div><div class="tool-grid">${tools.filter((tool) => tool.group === group).map(toolCard).join('') || '<div class="empty-state">Bu filtrede eşleşme yok.</div>'}</div></section>`).join('');
  return `<section class="tools-page"><div class="page-topline"><div><div class="eyebrow">Araç rafı</div><h1 class="page-title">Ne yapmak istersin?</h1><p class="page-lede">${TOOLS.length} araç, tek güvenli çalışma alanı.</p></div><label class="search-box"><span>⌕</span><input id="toolsSearch" type="search" value="${esc(state.query)}" placeholder="Araçlarda ara…" autocomplete="off"></label></div><div class="filter-row">${GROUPS.map((group) => `<button class="filter-chip ${state.filter === group ? 'is-active' : ''}" data-filter="${group}">${group}${group !== 'Tümü' ? ` · ${TOOLS.filter((tool) => tool.group === group).length}` : ` · ${TOOLS.length}`}</button>`).join('')}</div>${state.query ? `<div class="category-block"><div class="section-head"><div><h2>Arama sonuçları</h2><p>${tools.length} araç eşleşti.</p></div></div><div class="tool-grid">${tools.map(toolCard).join('') || '<div class="empty-state">Aradığın araç yok.</div>'}</div></div>` : grouped}</section>`;
}

function renderHistory() {
  const list = state.history.length ? `<div class="history-list">${state.history.map((entry) => { const tool = getTool(entry.toolId) || { label: 'Araç', icon: '◈' }; return `<div class="history-item"><span class="history-icon">${esc(tool.icon)}</span><div><b>${esc(tool.label)}</b><small>${esc(entry.fileName || 'Dosya seçilmedi')} · ${esc(entry.status || 'Tamamlandı')}</small></div><time>${esc(entry.time)}</time></div>`; }).join('')}</div>` : '<div class="empty-state"><div class="empty-icon">◷</div><h3>Henüz işlem yok</h3><p>Bir araç kullandığında burada dosya adı değil, yalnızca işlem özeti görünür.</p></div>';
  return `<section class="history-page"><div class="eyebrow">İz bırakmadan</div><div class="page-topline"><div><h1 class="page-title">Geçmiş</h1><p class="page-lede">Son işlemlerin cihazında, dosyaların değil.</p></div>${state.history.length ? '<button class="secondary-btn" data-action="clear-history">Geçmişi temizle</button>' : ''}</div>${list}</section>`;
}

function renderSettings() {
  return `<section class="settings-page"><div class="eyebrow">Kontrol sende</div><h1 class="page-title">Ayarlar</h1><p class="page-lede">Pratik’nin davranışını ve gizlilik tercihlerini düzenle.</p><div class="settings-grid"><article class="setting-card"><h3>Görünüm</h3><p>Uygulama ışıkta veya düşük ışıkta rahat görünsün.</p><div class="setting-line"><span>Karanlık tema</span><button class="switch ${state.theme === 'dark' ? 'is-on' : ''}" data-action="toggle-theme" aria-label="Karanlık temayı değiştir"></button></div><div class="setting-line"><span>Uygulama sürümü</span><strong>1.0</strong></div></article><article class="setting-card"><h3>Gizlilik</h3><p>Yerel kullanım tercihlerini ve kayıtları yönet.</p><div class="setting-line"><span>Dosya içeriği saklama</span><strong>Kapalı</strong></div><div class="setting-line"><span>İşlem sayısı</span><strong>${state.operationCount}</strong></div><div class="setting-line"><span>Geçmiş</span><button class="link-button" data-action="clear-history">Temizle</button></div></article><article class="setting-card"><h3>Kurulum</h3><p>Pratik’i ana ekranına ekleyerek daha hızlı aç.</p><button class="primary-btn" data-action="install">Ana ekrana ekle</button></article><article class="setting-card"><h3>Uygulama hakkında</h3><p>Desteklenen fotoğraf ve QR akışları ile videodan kare yakalama cihazında çalışır. Diğer PDF ve video araçları hazırlanıyor.</p><div class="privacy-note"><span class="status-dot"></span><span><strong>Çevrimdışı kabuk aktif</strong>Service worker bu uygulama kabuğunu cache’liyor.</span></div></article></div></section>`;
}

function renderLegalFooter() {
  return `<footer class="legal-footer"><div><strong>Ozguler Forge</strong><span>Pratik · ${SITE_URL.replace('https://', '')}</span></div><div class="footer-contact"><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a><a href="${SITE_URL}" target="_blank" rel="noreferrer">${SITE_URL}</a></div><nav aria-label="Yasal bağlantılar"><button data-legal="about">Hakkımızda</button><button data-legal="privacy">Gizlilik Politikası</button><button data-legal="terms">Kullanım Koşulları</button><button data-legal="contact">İletişim</button></nav><small>© 2026 Ozguler Forge. Tüm hakları saklıdır.</small></footer>`;
}

function renderLegal() {
  const pages = { about: 'Hakkımızda', privacy: 'Gizlilik Politikası', terms: 'Kullanım Koşulları', contact: 'İletişim' };
  const page = state.legalPage || 'privacy';
  const body = {
    about: `<h2>Ozguler Forge</h2><p>Ozguler Forge, günlük dijital iş akışlarını daha anlaşılır, daha hızlı ve daha mahrem hâle getirmeyi amaçlayan bir üretim markasıdır. Pratik; desteklenen fotoğraf, QR ve belge akışlarını mümkün olduğunca cihaz üzerinde tutan uygulama ürünümüzdür.</p><p>Ürün yaklaşımımız basit: Kullanıcı dosyası, kullanıcı kontrolü dışına çıkmadan işini tamamlayabilmeli. Bu nedenle hesap zorunluluğu, reklam ağı ve gereksiz izleme yerine açık arayüz, yerel işlem ve şeffaf açıklamayı tercih ediyoruz.</p><p>Web: <a href="${SITE_URL}" target="_blank" rel="noreferrer">${SITE_URL}</a><br>İletişim: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>`,
    privacy: `<h2>Gizlilik Politikası</h2><p><strong>Yürürlük tarihi:</strong> 26 Kasım 2026</p><p>Bu politika, <a href="${SITE_URL}" target="_blank" rel="noreferrer">${SITE_URL}</a> alan adında sunulan Pratik uygulamasında kişisel verilerin nasıl ele alındığını açıklar. Uygulama sağlayıcısı/marka: <strong>Ozguler Forge</strong>. İletişim: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p><h3>Dosyalar nasıl işlenir?</h3><p>Seçtiğin fotoğraf, video veya belge dosyası tarayıcının File API, Canvas ve benzeri cihaz içi yetenekleriyle işlenir. Dosyanın içeriğini sunucumuza yüklemek, incelemek veya kalıcı olarak depolamak için bir akış bulunmaz. Bu nedenle dosyanın güvenliği öncelikle kullandığın cihazın ve tarayıcının güvenliğine bağlıdır.</p><h3>Hangi bilgiler tutulur?</h3><p>Uygulama, deneyimi sürdürebilmek için tarayıcının <code>localStorage</code> alanında tema tercihini, işlem sayısını ve son işlemlerin araç adı/dosya adı/zaman özetini tutabilir. Dosya içeriği, dosyanın kendisi ve çıktı blob’ları kalıcı olarak saklanmaz. Geçmişi Ayarlar ekranından temizleyebilirsin.</p><h3>Çerezler, yerel kayıtlar ve teknik günlükler</h3><p>Uygulama reklam çerezi veya üçüncü taraf analitik kodu kullanmaz. Tema, işlem sayısı ve işlem geçmişi bu cihazın tarayıcısındaki localStorage alanında tutulur; tarayıcı ayarlarından da silinebilir. Service worker statik uygulama dosyalarını çevrimdışı kullanım için önbelleğe alır. Siteyi sunan barındırma hizmeti, bağlantı sırasında IP adresi ve istek zamanı gibi teknik sunucu günlüklerini kendi altyapısında işleyebilir; bu günlüklerin kapsamı ve saklama süresi barındırma sağlayıcısının yapılandırmasına bağlıdır.</p><h3>Hakların ve iletişim</h3><p>Tarayıcıda tutulan uygulama geçmişini Ayarlar bölümünden temizleyebilirsin. Gizlilik uygulamaları hakkında soru veya talep için <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> adresine yazabilir, <a href="${SITE_URL}" target="_blank" rel="noreferrer">${SITE_URL}</a> adresini ziyaret edebilirsin.</p>`,
    terms: `<h2>Kullanım Koşulları</h2><p><strong>Yürürlük tarihi:</strong> 26 Kasım 2026</p><p>Hizmet sağlayıcısı/marka: <strong>Ozguler Forge</strong>. Web: <a href="${SITE_URL}" target="_blank" rel="noreferrer">${SITE_URL}</a> · İletişim: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p><h3>Hizmetin kapsamı</h3><p>Pratik; desteklenen fotoğraf ve QR işlemleri ile görselden PDF oluşturma gibi akışları kullanıcı cihazında kolaylaştırmak amacıyla sunulan bir araç setidir. Video dönüştürme, PDF düzenleme ve bazı ileri işlevler bu sürümde henüz etkin değildir; arayüzde “Yakında” olarak belirtilen araçlar dosya üzerinde işlem yapmaz. Hizmet ücretsiz sunulabilir; özellikler, tarayıcı desteği ve cihaz kaynaklarına göre değişebilir.</p><h3>Kullanıcı sorumluluğu</h3><p>Yalnızca işleme hakkına sahip olduğun dosyaları kullanmalısın. Resmî belge, kişisel veri, telifli içerik veya üçüncü kişilere ait görüntüler üzerinde işlem yaparken gerekli izin ve hukuki yükümlülükler sana aittir.</p><h3>Çıktı ve garanti</h3><p>Tarayıcı tabanlı işlemlerde cihaz, işletim sistemi, dosya biçimi ve bellek sınırları sonucu etkileyebilir. Pratik çıktıların belirli bir kuruma, baskı standardına veya profesyonel iş akışına her durumda uygun olacağını garanti etmez. Önemli belgelerde çıktıyı kullanmadan önce kontrol et ve yedek al.</p><h3>Değişiklikler</h3><p>Uygulama özellikleri ve bu koşullar ihtiyaçlara göre güncellenebilir. Güncel metin her zaman <a href="${SITE_URL}" target="_blank" rel="noreferrer">${SITE_URL}</a> üzerinde yayımlanır. Sorular için <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> adresinden iletişime geçebilirsin.</p>`,
    contact: `<h2>İletişim</h2><p>Pratik ve Ozguler Forge hakkında soru, geri bildirim, hata bildirimi veya yasal başvuru için bize e-posta gönderebilirsin.</p><div class="contact-card"><span class="contact-symbol">@</span><div><strong>${CONTACT_EMAIL}</strong><small>Genel iletişim ve destek</small></div><a href="mailto:${CONTACT_EMAIL}">E-posta gönder →</a></div><p class="contact-domain">Web: <a href="${SITE_URL}" target="_blank" rel="noreferrer">${SITE_URL.replace('https://', '')}</a></p>`
  }[page];
  return `<section class="legal-page"><button class="back-btn" data-view="home">← Ana sayfaya dön</button><div class="eyebrow">Ozguler Forge · ${SITE_URL.replace('https://', '')}</div><div class="legal-layout"><nav class="legal-nav" aria-label="Yasal metinler">${Object.entries(pages).map(([key, label]) => `<button class="${page === key ? 'is-active' : ''}" data-legal="${key}">${label}</button>`).join('')}</nav><article class="legal-card">${body}<div class="legal-contact-strip"><strong>Yayıncı ve iletişim</strong><span>Ozguler Forge · <a href="${SITE_URL}" target="_blank" rel="noreferrer">${SITE_URL}</a></span><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></div><p class="legal-updated">Son güncelleme: 26 Kasım 2026 · Sorular için <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p></article></div></section>`;
}

function optionsFor(tool) {
  if (tool.kind === 'qr') return `<div class="field"><label>Metin veya bağlantı <span>zorunlu</span></label><textarea id="qrText" placeholder="https://ornek.com veya kısa bir mesaj">https://ozgulerforge.com.tr</textarea></div><div class="field"><label>Renk teması</label><select id="qrStyle"><option value="ink">Mürekkep / turkuaz</option><option value="dark">Koyu</option></select></div>`;
  if (tool.kind === 'video') {
    if (tool.id === 'frame') return `<div class="field"><label>Kare zamanı <span id="timeValue">0,5 sn</span></label><input id="frameTime" type="range" min="0" max="60" step="0.1" value="0.5"></div>`;
    if (tool.id === 'trim') return `<div class="field"><label>Başlangıç (sn)</label><input id="trimStart" type="number" min="0" step="0.1" value="0"></div><div class="field"><label>Bitiş (sn)</label><input id="trimEnd" type="number" min="0.1" step="0.1" value="10"></div>`;
    return `<div class="field"><label>Çıktı profili</label><select id="videoProfile"><option>Telefon için dengeli</option><option>WhatsApp — 16 MB altı</option><option>E-posta — küçük boyut</option><option>Orijinal kalite</option></select></div><div class="toggle-row"><span>Metadata bilgilerini temizle</span><button class="switch is-on" data-action="toggle-switch" aria-label="Metadata temizleme"></button></div>`;
  }
  if (tool.kind === 'pdf') {
    if (tool.id === 'pdf-split') return `<div class="field"><label>Sayfa aralığı</label><input id="pageRange" type="text" placeholder="1-3, 5, 8-10" value="1-3"></div><div class="toggle-row"><span>Boş sayfaları kaldır</span><button class="switch is-on" data-action="toggle-switch" aria-label="Boş sayfaları kaldır"></button></div>`;
    if (tool.id === 'pdf-sign') return `<div class="field"><label>İmza adı</label><input id="signName" type="text" placeholder="Ad Soyad"></div><div class="toggle-row"><span>İmzayı belgenin sonuna ekle</span><button class="switch is-on" data-action="toggle-switch" aria-label="İmzayı ekle"></button></div>`;
    return `<div class="field"><label>Çıktı adı <span>opsiyonel</span></label><input id="pdfName" type="text" placeholder="pikselce-belge"></div><div class="privacy-note"><span class="status-dot"></span><span><strong>Dosya sırası cihazında</strong>Birden fazla dosyayı sürükleyerek sırayı değiştirebilirsin.</span></div>`;
  }
  if (tool.id === 'resize') return `<div class="field"><label>Genişlik (px)</label><input id="resizeWidth" type="number" min="1" value="1200"></div><div class="field"><label>Yükseklik (px) <span>oran korunur</span></label><input id="resizeHeight" type="number" min="1" placeholder="otomatik"></div><div class="toggle-row"><span>Oranı koru</span><button class="switch is-on" data-action="toggle-switch" aria-label="Oranı koru"></button></div><div class="field"><label>Format</label><select id="imageFormat"><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option><option value="image/png">PNG</option></select></div>`;
  if (tool.id === 'compress') return `<div class="field"><label>Hedef boyut</label><select id="compressTarget"><option value="balanced">Dengeli kalite</option><option value="102400">100 KB altında hedefle</option><option value="51200">50 KB altında hedefle</option><option value="quality">Yüksek kalite</option></select></div><div class="field"><label>Kalite <span id="qualityValue">82%</span></label><input id="qualityRange" type="range" min="30" max="100" value="82"></div>`;
  if (tool.id === 'portrait') return `<div class="field"><label>Fotoğraf oranı</label><select id="portraitSize"><option value="35x45">35 × 45 mm — biyometrik</option><option value="50x60">50 × 60 mm — vesikalık</option></select></div><div class="toggle-row"><span>Beyaz arka plan</span><button class="switch is-on" data-action="toggle-switch" aria-label="Beyaz arka plan"></button></div>`;
  if (tool.id === 'background') return `<div class="field"><label>Kesim hassasiyeti <span id="thresholdValue">24</span></label><input id="thresholdRange" type="range" min="8" max="70" value="24"></div><div class="toggle-row"><span>Şeffaf PNG olarak ver</span><button class="switch is-on" data-action="toggle-switch" aria-label="Şeffaf PNG"></button></div>`;
  if (tool.id === 'blur') return `<div class="field"><label>Gizleme biçimi</label><select id="blurStyle"><option value="blur">Bulanıklaştır</option><option value="pixel">Pikselleştir</option><option value="block">Renkli blok</option></select></div><div class="field"><label>Bölge</label><select id="blurArea"><option value="center">Merkezdeki yüz / plaka</option><option value="top">Üst bölüm</option><option value="bottom">Alt bölüm</option></select></div>`;
  return `<div class="field"><label>Çıktı formatı</label><select id="imageFormat"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></div><div class="field"><label>Kalite <span id="qualityValue">88%</span></label><input id="qualityRange" type="range" min="30" max="100" value="88"></div>`;
}

function renderTool() {
  const tool = getTool(state.activeTool) || TOOLS[0];
  const accept = tool.accept ? `accept="${esc(tool.accept)}"` : '';
  const hasFiles = state.files.length > 0;
  const fileList = state.files.map((file, index) => `<div class="file-row"><span class="file-mini">${file.type.startsWith('video') ? '▶' : file.type === 'application/pdf' ? '▤' : '▧'}</span><div><b>${esc(file.name)}</b><small>${formatBytes(file.size)} · cihazında</small></div><button class="file-remove" data-action="remove-file" data-index="${index}" aria-label="Dosyayı kaldır">×</button></div>`).join('');
  const available = isToolAvailable(tool);
  const result = state.result ? `<div class="result-card"><span class="result-check">✓</span><div class="result-copy"><h3>${esc(state.result.title)}</h3><p>${esc(state.result.description)}</p></div>${state.result.url ? `<a href="${state.result.url}" download="${esc(state.result.name)}">İndir ↓</a>` : ''}</div>` : '';
  return `<section class="tool-page"><button class="back-btn" data-action="back">← Araçlara dön</button><div class="tool-heading"><span class="tool-symbol">${esc(tool.icon)}</span><div><div class="eyebrow">${esc(tool.group)} ${tool.badge ? `· ${esc(tool.badge)}` : ''}</div><h1>${esc(tool.label)}</h1><p>${esc(tool.desc)}</p></div></div><div class="workspace"><div><div class="dropzone ${hasFiles ? 'has-file' : ''}" id="dropzone"><div><div class="drop-icon">${hasFiles ? '✓' : '↑'}</div><b>${hasFiles ? `${state.files.length} dosya seçildi` : 'Dosyanı buraya bırak'}</b><p>${hasFiles ? 'İstersen başka dosyalar da ekleyebilirsin.' : 'veya cihazından seçerek başla'}</p><label class="file-label">Dosya seç<input id="filePicker" type="file" ${accept} ${tool.id === 'pdf-merge' || tool.id === 'jpg-pdf' ? 'multiple' : ''}></label><small class="file-hint">Dosyan sunucuya yüklenmez · işlem cihazında</small></div></div><div class="file-list">${fileList}</div>${result}<div class="tool-tips">${esc(tool.tip)}${available ? '' : ' Bu özellik henüz etkin değil; bu sürüm dosyan üzerinde işlem yapmaz.'}</div></div><aside class="options-card"><h3>Çıktını ayarla</h3>${optionsFor(tool)}<button class="primary-btn" data-action="process" ${available ? '' : 'disabled'}>${available ? (tool.kind === 'qr' ? 'QR oluştur' : 'İşlemi başlat') : 'Bu özellik henüz hazır değil'} ${available ? '<span>→</span>' : ''}</button><div class="privacy-note"><span class="status-dot"></span><span><strong>Gizli çalışma</strong>Dosyan bu cihazdan ayrılmaz.</span></div></aside></div></section>`;
}

function render() {
  if (state.activeTool) root.innerHTML = renderTool();
  else if (state.legalPage) root.innerHTML = renderLegal();
  else if (state.view === 'tools') root.innerHTML = renderTools();
  else if (state.view === 'history') root.innerHTML = renderHistory();
  else if (state.view === 'settings') root.innerHTML = renderSettings();
  else root.innerHTML = renderHome();
  document.querySelectorAll('[data-view]').forEach((node) => node.classList.toggle('is-active', !state.activeTool && node.dataset.view === state.view));
  document.querySelectorAll('[data-filter]').forEach((node) => node.classList.toggle('is-active', node.dataset.filter === state.filter));
  document.getElementById('historyCount').textContent = state.history.length;
  document.getElementById('toolCount').textContent = TOOLS.length;
  document.getElementById('dockHistoryDot').hidden = !state.history.length;
  saveTheme();
}

function navigate(view, filter) {
  state.activeTool = null;
  state.legalPage = null;
  state.view = view;
  if (filter) state.filter = filter;
  if (view !== 'tools') state.query = '';
  location.hash = view;
  render();
  root.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openTool(id) {
  if (!getTool(id)) return;
  state.activeTool = id;
  state.legalPage = null;
  state.view = 'tools';
  state.files = [];
  state.result = null;
  location.hash = `tool/${id}`;
  render();
  root.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openLegal(page) {
  state.activeTool = null;
  state.legalPage = ['about', 'privacy', 'terms', 'contact'].includes(page) ? page : 'privacy';
  state.view = 'legal';
  location.hash = `legal/${state.legalPage}`;
  render();
  root.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toast(message, strong = '') {
  const region = document.getElementById('toastRegion');
  const node = document.createElement('div');
  node.className = 'toast';
  node.innerHTML = strong ? `<b>${esc(strong)}</b> ${esc(message)}` : esc(message);
  region.appendChild(node);
  window.setTimeout(() => node.remove(), 3500);
}

function addFiles(fileList) {
  const tool = getTool(state.activeTool);
  if (!tool) return;
  const isImage = (file) => file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif|tiff?)$/i.test(file.name);
  const isVideo = (file) => file.type.startsWith('video/') || /\.(mp4|m4v|mov|webm|avi|mkv)$/i.test(file.name);
  const isPdf = (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const incoming = Array.from(fileList || []).filter((file) => tool.kind === 'image' ? isImage(file) : tool.kind === 'video' ? isVideo(file) : tool.id === 'jpg-pdf' ? isImage(file) : tool.kind === 'pdf' ? isPdf(file) : true);
  if (!incoming.length) { toast('Bu araç için uygun bir dosya seç.', 'Dosya türü'); return; }
  state.files = tool.id === 'pdf-merge' || tool.id === 'jpg-pdf' ? [...state.files, ...incoming] : [incoming[0]];
  state.result = null;
  render();
}

function imageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Görsel tarayıcıda açılamadı.')); };
    image.src = url;
  });
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Çıktı oluşturulamadı.')), type, quality));
}

function outputExtension(type) { return type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'; }

async function processImage(tool) {
  const file = state.files[0];
  if (!file) throw new Error('Önce bir görsel seç.');
  const image = await imageFromFile(file);
  let width = image.naturalWidth || image.width;
  let height = image.naturalHeight || image.height;
  let type = 'image/jpeg';
  let quality = Number(document.getElementById('qualityRange')?.value || (tool.id === 'compress' ? 82 : 88)) / 100;
  const originalWidth = width;
  const originalHeight = height;
  if (tool.id === 'compress') {
    const target = document.getElementById('compressTarget')?.value || 'balanced';
    if (target === 'quality') quality = Math.max(quality, .92);
  }
  if (tool.id === 'resize') {
    const requestedWidth = Number(document.getElementById('resizeWidth')?.value || width);
    const requestedHeight = Number(document.getElementById('resizeHeight')?.value || 0);
    if (!Number.isFinite(requestedWidth) || requestedWidth < 1 || requestedWidth > 12000 || (requestedHeight && (requestedHeight < 1 || requestedHeight > 12000))) throw new Error('Ölçüler 1–12.000 piksel arasında olmalı.');
    const keepRatio = document.querySelector('.options-card .toggle-row .switch')?.classList.contains('is-on') ?? true;
    width = requestedWidth;
    height = keepRatio ? (requestedHeight || Math.round(originalHeight * width / originalWidth)) : (requestedHeight || originalHeight);
    type = document.getElementById('imageFormat')?.value || type;
  }
  if (tool.id === 'convert') type = document.getElementById('imageFormat')?.value || 'image/jpeg';
  if (tool.id === 'heic') type = 'image/jpeg';
  if (tool.id === 'portrait') {
    const size = document.getElementById('portraitSize')?.value || '35x45';
    const [mmW, mmH] = size.split('x').map(Number);
    width = mmW * 20; height = mmH * 20;
    const whiteBackground = document.querySelector('.options-card .toggle-row .switch')?.classList.contains('is-on') ?? true;
    type = whiteBackground ? 'image/jpeg' : 'image/png';
  }
  if (tool.id === 'background') type = 'image/png';
  if (tool.id === 'blur') type = 'image/jpeg';
  if (width * height > 40000000) throw new Error('Bu çıktı cihaz belleği için çok büyük. Daha küçük ölçü seç.');
  let canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  let ctx = canvas.getContext('2d', { willReadFrequently: true });
  const draw = () => {
    if (tool.id === 'portrait') {
      const targetRatio = width / height; const sourceRatio = image.width / image.height; let sx = 0; let sy = 0; let sw = image.width; let sh = image.height;
      if (sourceRatio > targetRatio) { sw = image.height * targetRatio; sx = (image.width - sw) / 2; } else { sh = image.width / targetRatio; sy = (image.height - sh) / 2; }
      const whiteBackground = document.querySelector('.options-card .toggle-row .switch')?.classList.contains('is-on') ?? true;
      if (whiteBackground) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); }
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
    } else ctx.drawImage(image, 0, 0, width, height);
    if (tool.id === 'background') removeSimpleBackground(ctx, width, height, Number(document.getElementById('thresholdRange')?.value || 24));
    if (tool.id === 'blur') paintPrivacyMask(ctx, width, height, document.getElementById('blurStyle')?.value || 'blur', document.getElementById('blurArea')?.value || 'center');
  };
  draw();
  let blob = await canvasBlob(canvas, type, quality);
  type = blob.type || type;
  const targetValue = tool.id === 'compress' ? document.getElementById('compressTarget')?.value : null;
  const targetBytes = targetValue === '51200' || targetValue === '102400' ? Number(targetValue) : 0;
  let attempts = 0;
  while (targetBytes && blob.size > targetBytes && attempts < 18) {
    attempts += 1;
    if (quality > .36) quality = Math.max(.35, quality - .08);
    else if (width > 240 && height > 240) {
      width = Math.max(240, Math.round(width * .9)); height = Math.max(240, Math.round(height * .9));
      canvas.width = width; canvas.height = height; ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0, width, height);
    } else break;
    blob = await canvasBlob(canvas, type, quality);
  }
  const suffix = tool.id === 'metadata' ? 'metadata-temiz' : tool.id === 'portrait' ? 'vesikalik' : tool.id === 'background' ? 'arka-plan-saydam' : tool.id === 'blur' ? 'gizli-bolge' : tool.id;
  const targetNote = targetBytes ? (blob.size <= targetBytes ? ` · ${Math.round(targetBytes / 1024)} KB hedefi sağlandı` : ` · ${Math.round(targetBytes / 1024)} KB hedefi cihaz sınırı nedeniyle sağlanamadı`) : '';
  return { blob, name: `${baseName(file.name)}-${suffix}.${outputExtension(type)}`, description: `${formatBytes(blob.size)} · ${width} × ${height}px · cihazında oluşturuldu${targetNote}` };
}

function removeSimpleBackground(ctx, width, height, threshold) {
  const pixels = ctx.getImageData(0, 0, width, height); const data = pixels.data; const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
  const sample = corners.reduce((acc, [x, y]) => { const i = (y * width + x) * 4; acc[0] += data[i]; acc[1] += data[i + 1]; acc[2] += data[i + 2]; return acc; }, [0, 0, 0]).map((value) => value / 4);
  for (let i = 0; i < data.length; i += 4) { const distance = Math.abs(data[i] - sample[0]) + Math.abs(data[i + 1] - sample[1]) + Math.abs(data[i + 2] - sample[2]); if (distance < threshold * 3) data[i + 3] = 0; }
  ctx.putImageData(pixels, 0, 0);
}

function paintPrivacyMask(ctx, width, height, style, area) {
  const y = area === 'top' ? height * .08 : area === 'bottom' ? height * .72 : height * .36; const x = width * .18; const w = width * .64; const h = height * .22;
  if (style === 'block') { ctx.fillStyle = 'rgba(16,42,42,.93)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#36c8b0'; ctx.font = `${Math.max(13, width / 34)}px sans-serif`; ctx.fillText('GİZLİ', x + 15, y + h / 2 + 5); return; }
  if (style === 'pixel') { const temp = document.createElement('canvas'); temp.width = Math.max(1, Math.round(w / 14)); temp.height = Math.max(1, Math.round(h / 14)); temp.getContext('2d').drawImage(ctx.canvas, x, y, w, h, 0, 0, temp.width, temp.height); ctx.imageSmoothingEnabled = false; ctx.drawImage(temp, 0, 0, temp.width, temp.height, x, y, w, h); ctx.imageSmoothingEnabled = true; return; }
  ctx.save(); ctx.filter = 'blur(18px)'; ctx.drawImage(ctx.canvas, x, y, w, h, x, y, w, h); ctx.restore();
}

function makeQrCanvas(text, style) {
  if (typeof qrcode !== 'function') throw new Error('QR üretim modülü yüklenemedi. Sayfayı yenileyip tekrar dene.');
  const code = qrcode(0, 'M');
  code.addData(text, 'Byte');
  code.make();
  const modules = code.getModuleCount();
  const quiet = 4;
  const cell = Math.max(3, Math.floor(640 / (modules + quiet * 2)));
  const side = (modules + quiet * 2) * cell;
  const canvas = document.createElement('canvas'); canvas.width = side; canvas.height = side;
  const ctx = canvas.getContext('2d');
  const foreground = style === 'dark' ? '#102a2a' : '#123d39';
  const background = '#ffffff';
  ctx.fillStyle = background; ctx.fillRect(0, 0, side, side);
  ctx.fillStyle = foreground;
  for (let row = 0; row < modules; row += 1) for (let col = 0; col < modules; col += 1) {
    if (code.isDark(row, col)) ctx.fillRect((col + quiet) * cell, (row + quiet) * cell, cell, cell);
  }
  return canvas;
}

async function captureVideoFrame(file) {
  const url = URL.createObjectURL(file); const video = document.createElement('video'); video.preload = 'metadata'; video.muted = true; video.src = url;
  try {
    await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = () => reject(new Error('Video açılamadı veya bu tarayıcı biçimi desteklemiyor.')); });
    if (!video.videoWidth || !video.videoHeight || !Number.isFinite(video.duration)) throw new Error('Video bilgileri okunamadı.');
    const requested = Math.min(Number(document.getElementById('frameTime')?.value || .5), Math.max(0, video.duration - .05));
    if (requested > 0.001) await new Promise((resolve, reject) => { video.onseeked = resolve; video.onerror = () => reject(new Error('Videoda seçilen kareye ulaşılamadı.')); video.currentTime = requested; });
    else if (video.readyState < 2) await new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = () => reject(new Error('Videonun ilk karesi okunamadı.')); });
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext('2d').drawImage(video, 0, 0);
    const blob = await canvasBlob(canvas, 'image/png'); return { blob, name: `${baseName(file.name)}-kare-${requested.toFixed(1)}s.png`, description: `${formatBytes(blob.size)} · ${video.videoWidth} × ${video.videoHeight}px · ${requested.toFixed(1)} sn` };
  } finally { video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
}

async function jpgToPdf(files) {
  const pages = [];
  for (const file of files) {
    const image = await imageFromFile(file);
    const maxW = 595.28; const maxH = 841.89;
    const pageW = image.width >= image.height ? maxH : maxW;
    const pageH = image.width >= image.height ? maxW : maxH;
    const scale = Math.min(pageW / image.width, pageH / image.height, 1);
    const drawW = Math.max(1, image.width * scale); const drawH = Math.max(1, image.height * scale);
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    const jpeg = await canvasBlob(canvas, 'image/jpeg', .92);
    pages.push({ bytes: new Uint8Array(await jpeg.arrayBuffer()), imageW: image.width, imageH: image.height, pageW, pageH, drawW, drawH, fileName: file.name });
  }
  const enc = new TextEncoder(); const chunks = []; const offsets = [0]; let length = 0;
  const push = (part) => { const bytes = typeof part === 'string' ? enc.encode(part) : part; chunks.push(bytes); length += bytes.length; };
  const pageIds = pages.map((_, i) => 3 + i * 3);
  const objectCount = 2 + pages.length * 3;
  push('%PDF-1.4\n%âãÏÓ\n');
  const writeObject = (id, parts) => { offsets[id] = length; push(`${id} 0 obj\n`); parts.forEach(push); push('\nendobj\n'); };
  writeObject(1, [`<< /Type /Catalog /Pages 2 0 R >>`]);
  writeObject(2, [`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`]);
  pages.forEach((page, index) => {
    const pageId = pageIds[index]; const imageId = pageId + 1; const contentId = pageId + 2; const x = (page.pageW - page.drawW) / 2; const y = (page.pageH - page.drawH) / 2;
    const content = `q\n${page.drawW.toFixed(3)} 0 0 ${page.drawH.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm\n/Im${index + 1} Do\nQ\n`;
    const contentBytes = enc.encode(content);
    writeObject(pageId, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.pageW.toFixed(3)} ${page.pageH.toFixed(3)}] /Resources << /XObject << /Im${index + 1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`]);
    offsets[imageId] = length; push(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.imageW} /Height ${page.imageH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`); push(page.bytes); push('\nendstream\nendobj\n');
    offsets[contentId] = length; push(`${contentId} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`); push(contentBytes); push('endstream\nendobj\n');
  });
  const xrefOffset = length; push(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= objectCount; id += 1) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  const output = new Uint8Array(length); let cursor = 0; chunks.forEach((chunk) => { output.set(chunk, cursor); cursor += chunk.length; });
  const requestedName = document.getElementById('pdfName')?.value.trim();
  const safeName = requestedName ? requestedName.replace(/[/\\?%*:|"<>]/g, '-').replace(/\.pdf$/i, '') : `${baseName(files[0].name)}${files.length > 1 ? '-ve-digerleri' : ''}-pikselce`;
  return { blob: new Blob([output], { type: 'application/pdf' }), name: `${safeName || 'pikselce-belge'}.pdf`, description: `${formatBytes(output.length)} · ${pages.length} sayfa · cihazında oluşturuldu` };
}

async function processCurrentTool() {
  const tool = getTool(state.activeTool); if (!tool) return;
  if (!isToolAvailable(tool)) { toast('Bu özellik bu sürümde etkin değil; dosyan işlenmedi.', 'Henüz hazır değil'); return; }
  if (tool.kind !== 'qr' && !state.files.length) { toast('Önce bir dosya seç veya buraya bırak.', 'Hazır değil'); return; }
  const button = document.querySelector('[data-action="process"]'); if (button) { button.disabled = true; button.innerHTML = 'İşleniyor…'; }
  try {
    let result;
    if (tool.kind === 'image') result = await processImage(tool);
    else if (tool.id === 'frame') result = await captureVideoFrame(state.files[0]);
    else if (tool.id === 'jpg-pdf') result = await jpgToPdf(state.files);
    else if (tool.kind === 'qr') { const text = document.getElementById('qrText')?.value.trim(); if (!text) throw new Error('QR koduna dönüştürmek için metin veya bağlantı yaz.'); const canvas = makeQrCanvas(text, document.getElementById('qrStyle')?.value); const blob = await canvasBlob(canvas, 'image/png'); result = { blob, name: 'pratik-qr.png', description: `${formatBytes(blob.size)} · ${canvas.width} × ${canvas.height}px · cihazında üretildi` }; }
    if (state.result?.url) URL.revokeObjectURL(state.result.url);
    if (result.blob) result.url = URL.createObjectURL(result.blob);
    result.title = result.title || 'Çıktın hazır'; state.result = result; state.operationCount += 1; state.history.unshift({ toolId: tool.id, fileName: state.files[0]?.name || 'Metin / QR', status: result.blob ? 'Çıktı hazır' : 'Akış hazır', time: new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(new Date()) }); state.history = state.history.slice(0, 30); persist(); render(); toast('İşlem cihazında tamamlandı.', 'Hazır');
  } catch (error) {
    if (button) { button.disabled = false; button.innerHTML = `${tool.kind === 'qr' ? 'QR oluştur' : 'İşlemi başlat'} <span>→</span>`; }
    toast(error.message || 'İşlem sırasında bir hata oluştu.', 'Bir sorun oldu');
  }
}

function parseHash() {
  const hash = currentHash();
  if (hash.startsWith('tool/')) {
    const nextTool = hash.split('/')[1];
    if (!getTool(nextTool)) { state.activeTool = null; state.legalPage = null; state.view = 'tools'; return; }
    if (state.activeTool !== nextTool) { if (state.result?.url) URL.revokeObjectURL(state.result.url); state.files = []; state.result = null; }
    state.legalPage = null; state.activeTool = nextTool; state.view = 'tools';
  } else if (hash.startsWith('legal/')) { state.activeTool = null; state.legalPage = hash.split('/')[1]; state.view = 'legal'; }
  else if (['home', 'tools', 'history', 'settings'].includes(hash)) { state.activeTool = null; state.legalPage = null; state.view = hash; }
}

async function installApp() {
  if (!deferredInstallPrompt) { toast('Tarayıcının menüsünden “Ana ekrana ekle” seçeneğini kullanabilirsin.', 'Kurulum'); return; }
  deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; document.getElementById('installPrompt').hidden = true; document.getElementById('installBtn').hidden = true;
}

document.addEventListener('click', (event) => {
  const viewNode = event.target.closest('[data-view]'); if (viewNode) { navigate(viewNode.dataset.view, viewNode.dataset.filter); return; }
  const legalNode = event.target.closest('[data-legal]'); if (legalNode) { openLegal(legalNode.dataset.legal); return; }
  const toolNode = event.target.closest('[data-tool]'); if (toolNode) { openTool(toolNode.dataset.tool); return; }
  const filterNode = event.target.closest('[data-filter]'); if (filterNode) { state.filter = filterNode.dataset.filter; state.query = ''; render(); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'back') { navigate('tools'); return; }
  if (action === 'process') { processCurrentTool(); return; }
  if (action === 'remove-file') { state.files.splice(Number(event.target.closest('[data-index]')?.dataset.index || 0), 1); if (state.result?.url) URL.revokeObjectURL(state.result.url); state.result = null; render(); return; }
  if (action === 'clear-history') { state.history = []; persist(); render(); toast('Geçmiş temizlendi.'); return; }
  if (action === 'toggle-theme') { state.theme = state.theme === 'dark' ? 'light' : 'dark'; render(); return; }
  if (action === 'toggle-switch') { event.target.closest('.switch')?.classList.toggle('is-on'); return; }
  if (action === 'install') { installApp(); return; }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'homeSearch' || event.target.id === 'toolsSearch') { state.query = event.target.value; if (event.target.id === 'homeSearch' && !state.query) render(); else render(); const input = document.getElementById(event.target.id); if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } }
  if (event.target.id === 'qualityRange') { const label = document.getElementById('qualityValue'); if (label) label.textContent = `${event.target.value}%`; }
  if (event.target.id === 'thresholdRange') { const label = document.getElementById('thresholdValue'); if (label) label.textContent = event.target.value; }
  if (event.target.id === 'frameTime') { const label = document.getElementById('timeValue'); if (label) label.textContent = `${Number(event.target.value).toFixed(1).replace('.', ',')} sn`; }
});

document.addEventListener('change', (event) => { if (event.target.id === 'filePicker') addFiles(event.target.files); });
document.addEventListener('dragover', (event) => { const zone = event.target.closest('#dropzone'); if (zone) { event.preventDefault(); zone.classList.add('is-over'); } });
document.addEventListener('dragleave', (event) => { event.target.closest('#dropzone')?.classList.remove('is-over'); });
document.addEventListener('drop', (event) => { const zone = event.target.closest('#dropzone'); if (!zone) return; event.preventDefault(); zone.classList.remove('is-over'); addFiles(event.dataTransfer.files); });

document.getElementById('themeBtn').addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; render(); });
document.getElementById('promptInstall').addEventListener('click', installApp);
document.getElementById('promptClose').addEventListener('click', () => { document.getElementById('installPrompt').hidden = true; });
window.addEventListener('hashchange', () => { parseHash(); render(); });
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstallPrompt = event; document.getElementById('installBtn').hidden = false; document.getElementById('installPrompt').hidden = false; });
window.addEventListener('appinstalled', () => { document.getElementById('installPrompt').hidden = true; document.getElementById('installBtn').hidden = true; toast('Pratik ana ekranında.', 'Kuruldu'); });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register(new URL('./sw.js', import.meta.url)).catch(() => {}));

state.theme = saved.theme || 'light'; parseHash(); render();
