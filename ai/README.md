# Forge AI (v6.9.30)

## v6.9.27
- **Okunabilirlik:** Kenar çubuğu 288 px → 320 px, sohbet sütunu genişletildi (768 → 896 px); menü, liste, yanıt ve yazı alanı fontları büyütüldü; 10–11 px’lik küçük yazılar 12–13 px’e çıkarıldı.

## v6.9.26
- **Kenar çubuğu yenilendi (Claude tarzı):** Düz satırlı gezinme (Yeni Çalışma, Ara), sade çalışma listesi; sohbet seçme kutusu üzerine gelince veya seçim yapılırken görünür.
- **Google girişi en alta alındı:** Giriş düğmesi / hesap bilgisi sol alttadır; yanındaki “⋯” (veya hesap alanı) açılır hesap menüsünü açar. Motor Ayarları, bulut eşitleme, uygulamayı kur, yedekleme, hakkında ve çıkış bu menüdedir.
- **Yasal metinler açılır karta alındı:** Menüde “Yasal Bilgiler” satırına basınca dört metin kartı açılır.
- **“Hafızam” özelliği kaldırıldı:** Düğme, pencere ve sohbete not ekleme kodu silindi; cihazda kalan eski hafıza notu uygulama açılınca temizlenir.

## v6.9.20

## v6.9.20
- Gemini 4 Hydrogen istekleri güncel API gereksinimlerine uyarlandı: temperature ayarı kaldırıldı; Google Search aracı alanı güncellendi; eski temperature tercihi temizlenir. API anahtarı yardım metnine yetkilendirme/kısıtlama notu eklendi.

## v6.9.19
- **Tek sağlayıcı: Google Gemini.** Groq ve sağlayıcı yönlendirme kodu kaldırıldı. Önceki sürümde tarayıcıda saklanan eski Groq anahtarı ve sağlayıcı seçimi uygulama açıldığında silinir.
- **Yasal menü:** Sol menüye Kullanım Politikası, Gizlilik/KVKK taslağı, Hizmet Şartları ve Yazılım Lisansları eklendi. Metinler genel taslaktır; yayımdan önce hukuk danışmanı ve gerçek veri işleme süreçleriyle gözden geçirilmelidir.

## Önceki arayüz iyileştirmeleri
- İşlem süresi canlı gösterilir ve tamamlanan yanıtın altında saklanır; Web araması açıkken süre “Web araması + yanıt” olarak etiketlenir.
- Fotoğraf Stüdyosu kaldırıldı; görsel ekleme ve üretilen web/belge/kod önizlemeleri kullanılabilir.
- Uzun satırlar sohbet alanında kırılır; kod blokları yatay kaydırmayı kendi alanlarında tutar.
- Yanıt ilerleme adımları Forge AI markasıyla gösterilir.

**Geliştirici:** Ozguler Forge  
**İletişim:** iletisim@ozgulerforge.com.tr

## v6.9.10
- "Authorized domains" hata mesajı artık sitenin açıldığı adresi (hostname) gösterir.

## v6.9.9
- `auth/configuration-not-found` hatası için açıklayıcı Türkçe mesaj eklendi (Authentication başlatılmamış).

## v6.9.8
- **Bulut eşitleme (Firebase):** Kenar çubuğundaki "☁️ Sohbetleri bulutla eşitle" düğmesi Google ile Firebase'e giriş yapar; sohbetler Firestore'a (`users/{uid}/chats/{sohbetId}`) yazılır ve diğer cihazlarda otomatik görünür. Silmeler de eşitlenir. Ekler (PDF/fotoğraf) cihazda kalır, eşitlenmez. Tek sohbet ~900 KB'ı aşarsa eşitlenmez.
- **Kurulum (Firebase Console > forge-ai-83cea):**
  1. Authentication > Sign-in method > **Google**'ı etkinleştirin.
  2. Authentication > Settings > **Authorized domains** listesine sitenizin alan adını ekleyin.
  3. Firestore Database oluşturun ve Rules bölümüne şunu yazın:
     ```
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /users/{uid}/chats/{chatId} {
           allow read, write: if request.auth != null && request.auth.uid == uid;
         }
       }
     }
     ```

## v6.9.7
- Firebase kodu Firebase Console'un verdiği biçimle değiştirildi (`firebase-app.js` 13.3.0).

## v6.9.6
- **Firebase:** `forge-ai-83cea` projesinin yapılandırması `index.html` sonuna eklendi (`firebase-app.js` CDN'den yüklenir, `window.firebaseApp` olarak erişilir). Şimdilik yalnızca başlatma yapılır; Auth/Firestore henüz kullanılmıyor.

## v6.9.5
- **Mobil düzeltme:** Sohbet kutusunun altındaki "Gönder" düğmesi dar ekranlarda sağa taşıp kesiliyordu. Düğme artık küçülmez ve her zaman tam görünür; model seçici kalan alana sığacak şekilde kısalır.

## v6.9.4
- **Toplu silme:** Sol taraftaki her sohbetin başında küçük bir onay kutusu var. Kutuları işaretleyince üstte "N seçili" çubuğu çıkar: "Tümünü seç" (aramayla süzülen listeye uygulanır), "Vazgeç" ve "Sil". Silmeden önce onay istenir; sohbetlerin ekleri de silinir.

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
