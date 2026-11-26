# Kontak — Kayıpsız Resim ve Video Dönüştürücü (PWA)

Geliştirici: **Ozguler Forge** (`https://ozgulerforge.com.tr`)
İletişim: `iletisim@ozgulerforge.com.tr`
Sürüm: `v2.4.0`

Tamamen tarayıcıda çalışır (`ffmpeg.wasm 0.12` / `FFmpeg 5.1.4`). Dosyalar cihazdan çıkmaz, ilk açılıştan sonra çevrimdışı çalışır.
Her dönüşümden sonra kaynak ve çıktının her karesi yeniden çözülüp özetleri (MD5) karşılaştırılır; ses de aynı şekilde doğrulanır.

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
Bu ZIP paketindeki dosyaları (`index.html`, `styles.css`, `manifest.webmanifest`, `sw.js`, `README.md`) mevcut `donusturucu/` klasörünüzdeki dosyaların üzerine yazmanız yeterlidir. Mevcut `js/`, `vendor/` ve `icons/` klasörleriniz olduğu gibi korunur.
