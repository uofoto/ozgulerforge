# Kontak — Kayıpsız Resim ve Video Dönüştürücü (PWA)

Geliştirici: **Ozguler Forge** (`https://ozgulerforge.com.tr`)
İletişim: `iletisim@ozgulerforge.com.tr`
Sürüm: `v2.6.1`

Tamamen tarayıcıda çalışır (`ffmpeg.wasm 0.12` / `FFmpeg 5.1.4`). Dosyalar cihazdan çıkmaz, ilk açılıştan sonra çevrimdışı çalışır.
Her dönüşümden sonra kaynak ve çıktının her karesi yeniden çözülüp özetleri (MD5) karşılaştırılır; ses de aynı şekilde doğrulanır.

## PDF grubu eklendi
- “Hedef biçim ve profil” panelinde Resim / Video gibi yeni bir **PDF** grubu: **PDF Birleştir**, **PDF Böl** (seç · ayır · sil), **PDF → JPG** ve **JPG → PDF**. (PDF İmzala yok.)
- Her şey tarayıcıda çalışır, dosyalar cihazdan çıkmaz. Motorlar (`vendor/pdf-lib`, `vendor/pdfjs`) ilgili araç ilk kullanıldığında yüklenir; çevrimdışı önbelleğe alınır.
- Yeni/değişen dosyalar: `js/pdf-tools.js` (yeni), `vendor/pdf-lib/`, `vendor/pdfjs/` (yeni), `index.html`, `styles.css`, `sw.js`; `js/app.js`'te yalnızca 3 satır (içe aktarma, başlatma, grubun yerleşimi).

## v2.6.1 — Açılış animasyonu geri geldi
- Logo animasyonlu açılış (netleşme, kare kare yaylanma, ışık süpürmesi, üst menü logosuna kenetlenme) lavanta temaya uyarlanarak geri eklendi.
- Alt çubuktaki turuncu renk eski manifestteki `theme_color: #f59e0b` değerinden gelir; telefon bunu önbellekte tutar. Manifest bağlantısına sürüm eklendi. Kalıcı çözüm: yüklü uygulamayı silip yeniden yükle.

## v2.6.0 — Telefon düzeni, alt çubuk, hızlı WebP
- **Açılır bölümler:** “Hedef biçim ve profil”, “Nasıl kullanılır?” ve teknik bilgiler tek dokunuşla açılıp kapanan kartlar oldu. Telefonda kapalı, geniş ekranda açık başlar; kapalıyken seçili biçim/çaba özeti görünür. Telefonda hero daha kompakt (rozet ve ipucu satırları gizlendi).
- **Alt çubuk:** sayfa zemini `html` düzeyine alındı, alt güvenli alan uygulama rengiyle doldurulur, `color-scheme` bildirildi. Turuncu çubuk sayfadan değil sistemden geliyorsa uygulamayı silip yeniden yükle.
- **WebP donma düzeltmesi:** libwebp kayıpsız 6/100 ayarı wasm'da 9 MP fotoğrafta dakikalar sürüyordu. Çabalar düşürüldü; >2,5 MP görselde en fazla “Dengeli”, >6 MP görselde “Hızlı” kullanılır. Resimlerde ilerleme çubuğu artık donmuş görünmez, büyük görselde uyarı çıkar, 2 dakikayı aşarsa işlem durdurulup tarayıcı kodlayıcısına geçilir.

## v2.5.3 — Sistem çubuğu rengi
- Manifest `theme_color` ve `background_color` sayfa zeminiyle (#f5f4ff) eşlendi; telefonda alttaki turuncu çubuk kalkar. Yüklü uygulama manifesti kendi yeniler (bir gün kadar sürebilir) ya da uygulamayı silip yeniden yükle.

## v2.5.2 — Telefonda bellek hatası düzeltmesi
- Büyük fotoğraflarda (ör. 9 MP HEIC) ffmpeg belleği yetmeyip çökerse JPEG/PNG/WebP hedeflerinde tarayıcının kendi kodlayıcısı otomatik denenir.

## v2.5.1 — İlerleme yüzdesi ve yeni sıra
- Sayfa sırası: halka (hedef) → dönüştürülecek dosyalar ve işlem kartları → düğmeler → dosya bırakma alanı → biçim/profil paneli. Dosya yokken kuyruk alanı gizlenir.
- Dönüştürme sırasında halkanın ortasında genel **% ilerleme** ve çevresinde ilerleme halkası; her dosya kartında ve “Dönüştür” düğmesinde de yüzde görünür. Bitince kısa süre “Bitti ✓” yazar.

## v2.4.0 — Etkileşimli biçim halkası
- Sağdaki halka artık **hedef biçim seçicidir**: biçime dokun, ortadaki **Dönüştür** düğmesine bas. Dosyayı doğrudan bir biçimin üstüne bırakırsan o biçime kendiliğinden çevrilir. Halka, aşağıdaki biçim etiketleriyle senkron çalışır.

## v2.3.0 — Yeni arayüz (sadeleştirilmiş)
- Açılış animasyonu, fazla rozetler ve “Güncelle” düğmesi kaldırıldı (güncelleme arka planda alınır, hazır olunca “Yeni Sürüm · Yükle” görünür).
- Nadir biçimler (JPEG 2000, QOI, PAM, TGA, AVI/MOV · FFV1/H.264, MKV · H.264, TIFF kareler) “Gelişmiş biçimler” altında toplandı.
- `js/app.js` de değişti.

- Lavanta/indigo renk dili, yuvarlak köşeli kartlar, gradyan düğmeler ve seçili etiketler; açık ve koyu tema.
- Açılış kartında **biçim halkası** (PNG, WebP, TIFF, JPEG, BMP, GIF, MKV, MP4).
- Daha ferah bırakma alanı, sade kuyruk kartları ve rehber. Yalnızca `index.html`, `styles.css`, `manifest.webmanifest`, `sw.js` değişti; `js/` dokunulmadı.

## Önceki güncelleme (v1.2.0)
- **1. Dönüşüm Hizalama (Signature) Açılış Animasyonu:** Açılışta optik netleşme, saat yönünde yaylanma, çapraz ışık süpürmesi ve üst menü logosuna kenetlenme geçişi.
- **Sadeleştirilmiş Üst Menü:** Teknik geliştirici rozetleri gizlendi; yerine **Uygulamayı İndir** (Android, masaüstü ve iOS Safari rehber destekli) ve **Güncellemeleri Kontrol Et** düğmeleri eklendi.
- **Nasıl Kullanılır Rehberi & Kurumsal Alt Bilgi:** 3 adımlı kullanım rehberi, sürüm bilgisi, Gizlilik Politikası, KVKK Aydınlatma Metni, Kullanım Koşulları ve Açık Kaynak Lisansları pencereleri eklendi.

## Kurulum / Dağıtım
Bu ZIP paketindeki dosyaları (`index.html`, `styles.css`, `manifest.webmanifest`, `sw.js`, `README.md`) mevcut `donusturucu/` klasörünüzdeki dosyaların üzerine yazmanız yeterlidir. `js/` ve `vendor/` klasörlerindeki yeni dosyaları (`js/pdf-tools.js`, `vendor/pdf-lib/`, `vendor/pdfjs/`) ve değişen `js/app.js`'i de kopyalayın; `icons/` klasörünüz olduğu gibi korunur.
