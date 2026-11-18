# Oforge AI (v6.9.58)

## Proje yapısı
Derleme gerektirmez; tarayıcı ES modülleri kullanır. Bir web sunucusundan yayınlanır (`file://` ile açılmaz).

```
index.html            iskelet + import haritası (sürüm önbellek koruması)
styles.css            stiller
app.js                arayüz ve uygulama durumu (sohbet, ekler, ayarlar, ilerleme göstergesi)
cloud.js              Firebase bulut eşitleme
config.js             sürüm, depolama anahtarları (KEYS), proxy ve Google ayarları
storage.js            localStorage'a açılan TEK kapı (hata vermez, bozuk veriyi yedekler)
prompts.js            modele her istekte eklenen kimlik/üslup metinleri
engines/              DOM'a dokunmayan motor katmanı
  models.js           motor kataloğu, anahtar var mı, kota havuzu
  router.js           istek türü, aday motor sırası
  index.js            yedek motora geçme (en fazla 3 deneme)
  attempt.js          tek denemeyi çalıştırır: istek → akış → hata sınıfı
  providers/          gemini.js, openrouter.js (istek gövdesi, adres, akış olayı)
  stream.js errors.js quota.js health.js media.js
tests/                birim testleri (`npm test`, ~1 sn)
tools/bump-version.mjs  sürümü ve import haritasını günceller
```

**Kurallar:** Yalnızca `storage.js` localStorage'a dokunur. `engines/` DOM'a ve `app.js`'e dokunmaz; arayüzle yalnızca `hooks` geri çağrıları üzerinden konuşur. Yeni sağlayıcı eklemek = `engines/providers/` altına bir dosya + `providers/index.js`'e bir satır.

**Yayınlamadan önce:** `node tools/bump-version.mjs 6.9.44` (sürümü ve import haritasını günceller), sonra `npm test`.

## v6.9.58
- **Akıllı başlangıç:** Boş başlangıç ekranına araştırma, metin geliştirme ve fotoğraf yorumlama için üç sade, tıklanabilir öneri eklendi.
- **Kullanıcı kontrollü hafıza:** Kullanıcı kendi notlarını açıkça ekleyebilir, düzenleyebilir veya silebilir. Notlar cihazda saklanır ve yalnızca ilgili olduğunda modele aktarılır.
- **Yanıt uzunluğu:** Kısa, dengeli ve ayrıntılı seçenekleri yazı alanının yanında sunulur; tercih saklanır.
- **Güvenilir çalışma alanı:** Her çalışmaya özel notlar eklenebilir; sohbetle ve sohbet yedeğiyle birlikte saklanır.
- **Yanıtı düzenleme:** Yanıt menüsüne kısaltma, genişletme, yeniden yazma ve belgeye dönüştürme işlemleri eklendi.
- **Ses ve mobil:** Sesle yazdırma düğmesinde etkin durum ve tekrarlı başlatma kontrolü iyileştirildi. Yeni kontroller küçük ekranlarda tek satırda ve sade biçimde düzenlendi.
- **Korunanlar:** Var olan sohbetler, motorlar, API ayarları, tema, renk, dosya ekleri, web araması ve mevcut bağlantılar değiştirilmedi.

## v6.9.45
- **İki motor:** Arayüzde yalnızca **AI Ultra 3.8** (varsayılan, güçlü) ve **AI Lite** (hızlı) vardır; Ayarlar → "Motor" altında seçilir, "Otomatik" ve eski "Oforge 1–5" adları kalktı. Her motor şu anda tek bir Gemini modeline bağlıdır (`engines/models.js`: Ultra → `gemini-3.8-flash`; Lite → `gemini-3.5-flash-lite`). Bu sürümde sağlayıcılar arası yedek model zinciri etkin değildir. Eski sürümden kalan motor seçimi (`auto`, `f1`…) AI Ultra 3.8'e döner. Gemini 1.5 Flash ve kod modeli (Oforge 5) çıkarıldı.
- **Cevap alanı sadeleşti:** Yanıt altındaki "(basit soru için seçildi)", "otomatik geçiş…" ve motor adı notları kaldırıldı; yalnızca kısa uyarı ve süre kalır. "Gücümü göster" (karşılama kartı, ⋯ menüsü, komut paleti, kılavuz, PWA kısayolu, ilk açılışta otomatik tur), "© 2026 Ozguler Forge" ve "Oforge AI v…" alt satırı kaldırıldı (sürüm "Hakkında" penceresinde durur).
- **Doyurucu yanıtlar:** `prompts.js` içindeki "~150 kelime", "1-3 cümle", "yalnızca sorulanı yanıtla" sınırları kalktı; yanıt artık gerekçeli ve örnekli, mantık sırasıyla yazılır.
- **Önemli cümle uyarı kutusu:** Model kritik cümleyi `> [!IMPORTANT]` / `> [!WARNING]` / `> [!TIP]` kutusuyla verir (en çok 1–2 kutu).
- **Akademik kaynak linki:** Akademik/bilimsel istekler algılanır (`classifyRequest` → `academic`) ve o istekte web araması (Google Arama) kendiliğinden açılır; model "Kaynaklar" başlığı altında tıklanabilir bağlantı verir, uyduramaz; bulamazsa Google Akademik arama bağlantısı verir.
- **Alternatif yönlendirme:** Her yanıtın altında 3 öneri düğmesi çıkar (konuyu derinleştir / farklı yaklaşım / kısa özet); dokununca soru olarak gönderilir. Model bloğu `[[ONERI]]…[[/ONERI]]` ile yazar, arayüz metinden ayıklar; düğmeler yalnızca son yanıtta görünür ve sohbet yeniden açılınca korunur.
- **Düzeltme:** Akış bittikten hemen sonra bekleyen bir ekran karesi, zenginleştirilmiş görünümün (uyarı kutuları vb.) üzerine yazabiliyordu; artık yazmıyor.

## v6.9.44
- **Yeni logo: "Of" monogramı:** Çekiç-örs işareti yerine turuncu→kırmızı degradeli "O" ve beyaz "f" harfleri geldi (`forge-mark.js`). Simgeler `icon-v5-192.png`, `icon-v5-512.png`, `icon-v5-maskable-512.png`, `apple-touch-icon-v5.png`; `manifest.json` ve `index.html` v5'e, bildirim simgesi de v5'e geçti. Logo kutuları (açılış, kenar çubuğu, tur, karşılama, yanıt avatarı) mavi→mor degrade yerine koyu `#0F1629` zemin kullanır. Animasyon: döngüde hafif nabız (`fm-of-mark`), karşılamada tek seferlik beliriş. Telefonda eski simge önbellekte kalabilir; uygulamayı kaldırıp yeniden kurun.
- **Sürüm etiketleri:** `index.html` içindeki statik `v6.9.41` etiketleri düzeltildi; rozete `data-app-version` eklendi ve `bump-version` bu etiketleri de güncelliyor. Açılış ekranında logo arkasındaki sıcak parıltı (`fm-heat`) artık çalışıyor.

## v6.9.43
- **Motor katmanı ayrıldı (`engines/`):** model kataloğu, hata sınıfları, kota, sağlık kaydı, istek yönlendirme, Gemini/OpenRouter sağlayıcıları, akış okuyucu ve yedek motora geçme mantığı DOM'dan bağımsız modüllere taşındı. `generateReply` yaklaşık 440 satırdan 140'a indi; yalnızca ilerleme göstergesi ve ekrana yazma kaldı. Davranış değişmedi (36 senaryoluk karşılaştırma testiyle doğrulandı).
- **Depolama tek kapıdan:** `app.js` ve `cloud.js` içindeki tüm `localStorage` çağrıları `storage.js`'e, anahtar adları `config.js`'e taşındı. Depolama kapalı/dolu/bozuk olsa da uygulama çökmez. Kayıtlı sohbet verisi bozuksa sessizce boş liste açılıp üzerine yazılmaz; ham veri `forge_ai_chats_corrupt_backup` anahtarına yedeklenir.
- **Düzeltme:** Bulut düğmesine basıldığında Firebase yüklenememişse (örn. çevrimdışı) bildirim yerine `forgeDialog is not defined` hatası oluşuyordu (v6.9.42'de modüle geçişle başlamıştı). Diyalog artık köprü (`forgeBridge.dialog`) üzerinden kullanılıyor.
- **Önbellek koruması:** `index.html` içindeki import haritası her modülün adresine `?v=<sürüm>` ekler; yeni `index.html` ile eski modüllerin karışması engellenir.
- **Testler:** `npm test` motor mantığını (yönlendirme, kota, sağlık, sağlayıcı istekleri, yedek motora geçme, iptal, zaman aşımı) ve depolamayı tarayıcısız doğrular.

## v6.9.42
- **Kod yapısı:** Tek dosyalık `index.html` (4.282 satır) parçalandı: `styles.css` (stiller), `app.js` (uygulama, ES modülü), `cloud.js` (Firebase bulut eşitleme, ES modülü) ve `forge-mark.js` (logo işareti). Davranış ve görünüm değişmedi (eski sürümle yan yana test edildi, ekran görüntüsü birebir aynı). Tema/açılış betikleri ve Tailwind ayarı, açılışta titreme olmaması için `index.html` içinde kaldı.
- **Dikkat:** Dosyalar artık ES modülü olduğundan `file://` ile açılmaz; yerelde denemek için bir web sunucusu gerekir (örn. `python3 -m http.server`). Yayınlarken `index.html` içindeki `?v=` değerlerini sürümle birlikte artırın (önbellek).

## v6.9.41
- **Adlandırma:** Arayüzde görünen "Forge" ifadeleri "Oforge" oldu: motor adları (Oforge 1–5), tema adı ve ilgili yardım metinleri. Şirket adı "Ozguler Forge" ile dahili anahtarlar/sınıflar (`forge_ai_*`, `html.forge` vb.) değişmedi, böylece sohbetler ve ayarlar korunur.

## v6.9.40
- **Oforge AI Otomatik geliştirildi:** İstek türü algılanır (basit soru, kod, analiz, belge, PDF, fotoğraf). Basit sorular hafif modele, belge/PDF/fotoğraf/uzun analiz güçlü modele, kod istekleri kod modeline yönlendirilir. Her model için yetenek tanımlıdır (`tier`, `vision`, `pdf`); PDF yalnızca Gemini motorlarına, fotoğraf Gemini ve Oforge 4'e gider.
- **Desteklenmeyen motora dosya gönderilmez:** Otomatik modda yalnızca dosyayı okuyabilen motorlar denenir. Elle seçilen motor okuyamıyorsa istek hiç gönderilmeden açıklayıcı mesaj gösterilir; eski eklerin yerine "dosya gönderilmedi" notu konur.
- **Hata türleri ayrıldı:** kota, bağlantı, anahtar, bakiye, model bulunamadı, yoğunluk, zaman aşımı, boş yanıt, güvenlik engeli, ek çok büyük. Her biri kendi başlığı ve çözüm önerisiyle gösterilir (artık her hatada "motor ayarlarını kontrol edin" yazmaz). Kota hatasında önceki limit kartı korunur.
- **Gereksiz tekrar yok:** Bir istek en fazla 3 motora gönderilir. Motor sağlığı hatırlanır: 404 → 12 saat, kota → sıfırlanma saatine kadar (OpenRouter `:free` modelleri tek havuz sayılır), anahtar/bakiye → 10 dk, bağlantı → 1 dk, yoğunluk/zaman aşımı/boş yanıt → 2 dk. Ek çok büyükse veya güvenlik filtresine takıldıysa başka motor denenmez; çevrimdışıyken istek gönderilmez. Ayarlar kaydedilince bu kayıt sıfırlanır.
- **Geçiş açıklanır:** Yanıtın altında kullanılan motor, seçilme nedeni ve olduysa otomatik geçiş yazar (örn. "Oforge 2.5 Flash (belge incelemesi için seçildi) · otomatik geçiş: Oforge 1 kota dolu"). Kayıtlı sohbetlerde de görünür.
- **Motor seçici gelişmiş ayarlara taşındı:** Yazı kutusunda artık motor menüsü yok; elle seçim Ayarlar → "Gelişmiş: motoru elle seç" altında. Varsayılan "Oforge AI Otomatik".


## v6.9.39
- **Simge = çekiç ve örs:** Uygulama/ana ekran simgesi ve mobil açılış (splash) görseli, eski güneş simgesi yerine Oforge'un çekiç-örs sembolüyle yenilendi (mavi→mor zemin, beyaz sembol): `icon-v4-192.png`, `icon-v4-512.png`, `icon-v4-maskable-512.png`, `apple-touch-icon-v4.png`. Sayfa içi açılış ekranında da çekiç-örs kutusu duruyor. Telefonda eski simge önbellekte kalabilir; uygulamayı kaldırıp yeniden kurun.

## v6.9.37
- **Yanıt üslubu:** Her istekte kısa, öz ve mobilde okunur yanıt kuralları (`ANSWER_STYLE`) modele eklenir: doğrudan cevap, gereksiz giriş/kapanış yok, çoğu yanıt ~150 kelime altı, kısa paragraf/madde, emoji yok. **Tablo artık yalnızca kullanıcı isterse** kullanılır; karşılaştırmalar maddelerle yazılır. Kurallar kayıtlı sistem isteminden bağımsız eklendiği için eski ayarı olanlarda da geçerlidir.

## v6.9.36
- **Yeni motorlar:** "Oforge 1.5 Flash" (gemini-1.5-flash), "Oforge 2.0 Flash" (gemini-2.0-flash) ve "Oforge 2.5 Flash" (gemini-2.5-flash) motor menüsüne eklendi; üçü de fotoğraf destekler. 1.5 Flash yalnızca elle seçilir (Otomatik moda dahil değildir); Google bu modeli kapatmış olabilir, 404 gelirse 2.0/2.5 kullanın.
- **Fotoğraf ekleme düzeltildi:** Aynı fotoğraf kaldırılıp tekrar seçilince tetiklenmiyordu (dosya seçici sıfırlanmıyordu). Ayrıca HEIC/okunamayan görseller artık sessizce yutulmuyor, uyarı veriliyor; şeffaf PNG'ler siyah çıkmıyor; seçici tüm görsel türlerini kabul ediyor. Otomatik modda fotoğraf varsa yalnızca görsel destekleyen motorlar denenir.
- **Yanıt hazırlanırken Manus tarzı durum:** Adım listesi artık varsayılan olarak kapalıdır; yalnızca "Düşünülüyor…" (animasyonlu noktalar) ve geçen süre görünür. Üzerine basınca adımlar açılır. Yazma aşamasında "Yanıt yazılıyor…" olur.


## v6.9.35
- **Yanıt alanı sadeleşti:** Yanıtın etrafındaki kart (kenarlık, arka plan, gölge) kaldırıldı; metin sayfa genişliğini kullanır.
- **Gemini tarzı alt çubuk:** Yanıtın altında yalnızca simgeler: 👍 👎 · Kopyala · Önizle/PDF (belge simgesi) · ⋯ menüsü (Sesli dinle, Paylaş…, WhatsApp, E-posta, Markdown indir). Kopyalayınca simge kısa süre ✓ olur. Uyarı ve yanıt süresi satırı altta küçük kalır.

## v6.9.34
- **Yeni ad: Oforge AI.** "Forge AI" adı başka birçok yerde kullanıldığından uygulama "Oforge AI" oldu; arayüzdeki, yapay zekâ kimliğindeki, bildirimdeki, manifest'teki ve indirilen dosya adlarındaki tüm "Forge AI" ifadeleri değiştirildi. Dahili anahtarlar (`forge_ai_*`), Firebase projesi ve manifest `id` aynı kaldığı için sohbetler ve ayarlar korunur.
- **Yeni logo yazısı:** "O" harfi Syne fontuyla amber→turuncu→gül gradyanında, "forge" Outfit fontuyla, "AI" küçük aralıklı rozet olarak yazılır (açılış ekranı, kenar çubuğu, üst çubuk, karşılama, hakkında).

## v6.9.33
- **PDF çıktısı düzeltildi:** "Çalışmayı Önizle / PDF" → "PDF" ile alınan çıktı boş sayfa veriyordu; yazdırma alanı gizli kaldığı için hiçbir şey çizilmiyordu. Artık yalnızca yazdırırken açılır, uygulamanın geri kalanı çıktıdan çıkarılır, uzun yanıtlar birden çok sayfaya bölünür, koyu temada da metin siyah kalır, kod blokları taşmadan satır kıvırır.

## v6.9.32
- **Yanıtın başına dön:** Uzun bir yanıtın içinde aşağı kaydırınca yazı kutusunun sağ üstünde "Yanıtın başına dön" düğmesi belirir; basınca o anki yanıtın en üstüne yumuşakça kayar. Yanıt akarken yukarı kaydırırsanız sayfa artık sizi zorla en alta çekmez (en alta inince otomatik takip yeniden başlar).
- **Paylaş ve beğen / beğenme:** Her yanıtın altında "Paylaş" menüsü (cihazın paylaşım ekranı, WhatsApp, e-posta, metni kopyala, `.md` indir) ve 👍 / 👎 işaretleri eklendi. İşaret yanıtla birlikte sohbet kaydında tutulur (bulut eşitleme açıksa diğer cihazlarda da görünür); aynı düğmeye tekrar basınca kalkar.
- **Limit uyarısı (Claude tarzı):** Kota/oran sınırı (HTTP 429) alınınca ham hata yerine "Kullanım sınırına ulaştınız" kartı gösterilir: sıfırlanma saati, canlı geri sayım, "Yeniden dene" (süre dolunca açılır) ve "Motor ayarları" düğmeleri. Yazı kutusunun üstünde de aynı bilgiyi veren ince bir uyarı şeridi durur; limit sıfırlanınca veya bir yanıt başarıyla gelince kaybolur. Sıfırlanma zamanı Google'ın `retryDelay` bilgisinden, günlük kotada Pasifik saatiyle gece yarısından (Gemini), OpenRouter'da `X-RateLimit-Reset` değerinden hesaplanır; bilgi yoksa "yaklaşık" etiketiyle 1 dakika gösterilir. Otomatik modda tüm motorlar limitteyse en yakın sıfırlanma gösterilir.


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
Tüm dosyaları aynı klasöre yükleyin: `index.html`, `sw.js`, `manifest.json`, `icon-v4-192.png`, `icon-v4-512.png`, `icon-v4-maskable-512.png`, `apple-touch-icon-v4.png`. HTTPS gereklidir. Sonraki sürümlerde `sw.js` içindeki `CACHE_NAME` değerini artırın.

## Bilinen sınırlar
- API anahtarı tarayıcıda (localStorage) tutulur: yalnızca kişisel kullanım içindir. Herkese açık dağıtım için bir sunucu tarafı proxy gerekir.
- `index.html` içindeki model adlarını (`gemini-3.6-flash`, `gemini-3.5-flash-lite`) Google'ın güncel model listesiyle doğrulayın.
