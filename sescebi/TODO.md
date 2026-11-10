# Ses Cebi — Teslim Öğeleri

## Mobil öncelikli PWA deneyimi
- [x] Uygulama Türkçe, mobil öncelikli ve ana ekrana eklenebilir bağımsız PWA görünümünde çalışmalı.
- [x] Uygulama seçilen “Cep Kaseti” yönünü kullanmalı: sıcak nostaljik tonlar, büyük dokunma hedefleri, okunaklı oynatma durumları.

## İzinli ses ekleme ve yerel saklama
- [x] Kullanıcı, sahip olduğu veya indirme izni bulunan ses dosyalarını cihazın dosya seçicisi üzerinden uygulamaya ekleyebilmeli.
- [x] İzinli, doğrudan medya dosyası bağlantısından ses ekleme ve kaydetme akışı desteklenmeli.
- [x] Eklenen ses dosyaları cihazda yerel ve kalıcı biçimde saklanmalı ve çevrimdışı erişilebilmeli.
- [x] İçerik ekleme akışında hak sahipliği veya indirme izni sorumluluğunu açıklayan kullanım onayı bulunmalı.

## Ses arşivi ve oynatıcı
- [x] Kayıtlı sesler ad, süre ve kaydetme durumuyla listelenmeli.
- [x] Mobil ses oynatıcı oynat, duraklat, ileri-geri sar ve ilerleme konumu kontrolleri sunmalı.
- [x] Dosya ekleme ve kaydetme işlemleri ilerleme, başarı ve başarısızlık durumlarını göstermeli.

## Güvenli bağlantı ve hata durumları
- [x] Geçersiz bağlantı, desteklenmeyen dosya ve depolama sorunları Türkçe olarak açıklanmalı.
- [x] Instagram oturumu, özel hesap erişimi, korumalı içerik çıkarma veya platform kısıtlarını aşma işlevleri kapsam dışında bırakılmalı.
- [x] Bağlantı doğrulaması, Instagram sayfa bağlantılarını ve uygulamanın desteklemediği oturum gerektiren adresleri reddetmeli.

## Teslim
- [x] PWA manifesti, PNG/SVG uygulama simgeleri ve service worker ile çevrimdışı uygulama kabuğu hazırlanmalı.
- [x] Statik üretim komutu ve route manifesti tanımlanmalı.

## Doğrulama notu
- `npm run build` başarılı.
- Service worker sözdizimi, manifest JSON’u ve route manifesti doğrulandı.
- Preview üzerinde mobil ana ekran screenshot’ı kontrol edildi.
- PWA manifesti, service worker, route manifesti ve 192/512 PNG ikonları HTTP 200 ile erişilebilir.

## Marka ve yasal bilgilendirme
- [x] Sayfanın üst bölümünde “ozguler forge” ibaresi görünmeli.
- [x] Alt bölümde `ozgulerforge.com.tr` ve `iletisim@ozgulerforge.com.tr` iletişim bilgileri görünmeli.
- [x] Alt bölümde kullanım/telif, gizlilik/depolama ve platform sınırlarını açıklayan Türkçe yasal bilgilendirme metinleri bulunmalı.
