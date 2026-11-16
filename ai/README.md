# Forge AI (v6.9.3)

**Geliştirici:** Ozguler Forge  
**İletişim:** iletisim@ozgulerforge.com.tr

## v6.9.3
- **OpenRouter desteği:** Ayarlar'a "OpenRouter API Anahtarı" ve model adı alanı eklendi. Gemini kotası dolduğunda (429 vb.) istek otomatik olarak OpenRouter'a yönlenir; model menüsünden "🌐 OpenRouter" seçilerek doğrudan da kullanılabilir. Yalnızca OpenRouter anahtarı girilirse Gemini anahtarı gerekmez. Görsel, PDF ve Web araması (`plugins: web`) desteklenir.

## v6.9.2
- "PRO" ibaresi kaldırıldı; ana ekran sadeleştirildi (4 öneri kartı kaldırıldı); mobilde sohbet kutusu büyütüldü (daha geniş yazı alanı, yalnızca simgeli düğmeler, 16 px yazı).

## v6.9.1
- "Forge AI Ultra 3.8" seçeneği kaldırıldı (çalışmıyordu). Model listesi: Otomatik ve Lite.

## v6.9 Değişiklikleri
1. **Otomatik model:** "Forge AI Otomatik" (varsayılan) basit soruları Lite'a, belge/uzun/analiz isteklerini `gemini-3.6-flash`'a yönlendirir (o yanıt vermezse Lite devreye girer); yanıtın altında hangi modelin kullanıldığı yazar.
2. **Anahtarsız (sunucu) mod:** `proxy-worker.js` Cloudflare Worker olarak yayınlanır; Gemini anahtarı yalnızca orada durur, Google girişi sunucuda doğrulanır, kişi başı günlük limit uygulanır. Ardından `index.html` içindeki `PROXY_URL` değerine worker adresini yazın; kullanıcıdan anahtar istenmez.
3. **Hafızam:** Kenar çubuğundaki "Hafızam" ile kullanıcı notlarını yazar/siler; notlar her sohbete eklenir, yalnızca cihazda saklanır.
4. **Web + kaynaklar:** Sohbet kutusundaki "Web" düğmesi açıkken Google Arama ile yanıt verilir, kaynak bağlantıları yanıtın altında gösterilir.

## v6.8 Değişiklikleri
1. **Ultra 3.8 hatası:** Model kota/yoğunluk/erişim nedeniyle (404/429/500/503) yanıt vermezse otomatik olarak `gemini-3.6-flash`, sonra `gemini-3.5-flash-lite` denenir; yanıtın altında hangi modelle cevaplandığı yazar. Hata mesajları artık model adı, HTTP kodu ve Türkçe açıklama içerir. (Ücretsiz anahtarlarda 3.8 Flash için kota kapalı olabilir; Google AI Studio'da projeye faturalandırma bağlamak gerekebilir.)
2. **Uyarı:** Her yapay zekâ yanıtının altında "Forge AI bir yapay zekâ modelidir, hata yapabilir." notu gösterilir.
3. **Model seçici:** Üst çubuktan kaldırıldı; sohbet kutusunun altında, Gönder düğmesinin yanında açılır/kapanır menü olarak yer alır.
4. **Google ile giriş:** Kenar çubuğunda "Google ile Giriş Yap" düğmesi; girişten sonra ad, e-posta ve fotoğraf gösterilir, yapay zekâ kullanıcıya adıyla hitap eder.
   - Google Cloud Console > APIs & Services > Credentials > *OAuth client ID* (Web application) oluşturun.
   - *Authorized JavaScript origins* listesine sitenizin adresini (örn. `https://siteniz.com`) ekleyin.
   - `index.html` içindeki `const GOOGLE_CLIENT_ID = '';` satırına Client ID'yi yazın.
   - Not: Giriş yalnızca tanıma amaçlıdır (sunucu doğrulaması yok); sohbetler hâlâ cihazda saklanır ve kullanıcıya göre ayrılmaz.

## v6.7 Düzeltmeleri

### Güvenlik
1. **Önizleme sandbox'ı:** `allow-same-origin` kaldırıldı. Yapay zekâ tarafından üretilen HTML artık `localStorage` (API anahtarı, sohbetler) içine erişemez.
2. **XSS koruması:** Markdown çıktısı `DOMPurify` ile temizlenir. DOMPurify yüklenemezse içerik düz metin olarak gösterilir.
3. **API anahtarı** artık URL'de değil, `x-goog-api-key` header'ında gönderilir.

### İşlev
4. **Belge/fotoğraf hafızası:** PDF, fotoğraf ve belge metinleri IndexedDB'de saklanır; takip sorularında model ekleri görmeye devam eder. Sohbet silinince ekler de silinir. Tek istek ~20 MB'ı aşarsa anlaşılır bir uyarı verilir.
5. **Mesaj butonları:** Önizle / Kopyala / Sesli Dinle artık metinde apostrof (`'`) olsa da bozulmaz (inline `onclick` kaldırıldı, olay delegasyonu kullanıldı). `/ozetle` slash komutundaki sözdizimi hatası giderildi.
6. **Model seçimi** artık kaydediliyor (`getItem` → `setItem`).
7. **Akış:** Render kare başına en fazla bir kez yapılır; boş yanıt / güvenlik engeli / `MAX_TOKENS` durumları kullanıcıya bildirilir. Sohbet silmeden önce onay istenir.

### PWA
8. **Service Worker:** `sw.js` cache'lenmez (önceki sürümde her kontrol yeni bir cache girdisi bırakıyordu); yalnızca 200/opaque yanıtlar cache'lenir; çevrimdışı fallback eklendi.
9. **Güncelleme akışı:** Kullanıcı meşgul değilse güncelleme otomatik uygulanır; yazı yazıyor, cevap akıyor veya ek varsa "Yenile" bildirimi gösterilir. İlk kurulumda gereksiz sayfa yenilemesi yok.
10. **İkonlar:** Gerçek PNG ikonlar (192, 512, maskable, apple-touch-icon). Manifest `id`'sinden sürüm eki kaldırıldı (sürüm değişince uygulama kimliği değişmesin).
11. Bağımlılık sürümleri sabitlendi; `user-scalable=no` kaldırıldı.

## Dağıtım
Tüm dosyaları aynı klasöre yükleyin: `index.html`, `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`. HTTPS gereklidir. Sonraki sürümlerde `sw.js` içindeki `CACHE_NAME` değerini artırın.

## Bilinen sınırlar
- API anahtarı tarayıcıda (localStorage) tutulur: yalnızca kişisel kullanım içindir. Herkese açık dağıtım için bir sunucu tarafı proxy gerekir.
- `index.html` içindeki model adlarını (`gemini-3.6-flash`, `gemini-3.5-flash-lite`) Google'ın güncel model listesiyle doğrulayın.
