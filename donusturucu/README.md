# Kontak — Kayıpsız Resim ve Video Dönüştürücü (PWA)

Geliştirici: **Ozguler Forge** (`https://ozgulerforge.com.tr`)
İletişim: `iletisim@ozgulerforge.com.tr`
Sürüm: `v1.2.0`

Tamamen tarayıcıda çalışır (`ffmpeg.wasm 0.12` / `FFmpeg 5.1.4`). Dosyalar cihazdan çıkmaz, ilk açılıştan sonra çevrimdışı çalışır.
Her dönüşümden sonra kaynak ve çıktının her karesi yeniden çözülüp özetleri (MD5) karşılaştırılır; ses de aynı şekilde doğrulanır.

## Bu Güncelleme Paketindeki Yenilikler (v1.2.0)
- **1. Dönüşüm Hizalama (Signature) Açılış Animasyonu:** Açılışta optik netleşme, saat yönünde yaylanma, çapraz ışık süpürmesi ve üst menü logosuna kenetlenme geçişi.
- **Sadeleştirilmiş Üst Menü:** Teknik geliştirici rozetleri gizlendi; yerine **Uygulamayı İndir** (Android, masaüstü ve iOS Safari rehber destekli) ve **Güncellemeleri Kontrol Et** düğmeleri eklendi.
- **Nasıl Kullanılır Rehberi & Kurumsal Alt Bilgi:** 3 adımlı kullanım rehberi, sürüm bilgisi, Gizlilik Politikası, KVKK Aydınlatma Metni, Kullanım Koşulları ve Açık Kaynak Lisansları pencereleri eklendi.

## Kurulum / Dağıtım
Bu ZIP paketindeki dosyaları (`index.html`, `styles.css`, `manifest.webmanifest`, `sw.js`, `README.md`) mevcut `donusturucu/` klasörünüzdeki dosyaların üzerine yazmanız yeterlidir. Mevcut `js/`, `vendor/` ve `icons/` klasörleriniz olduğu gibi korunur.
