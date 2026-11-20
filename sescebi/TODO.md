# Ses Cebi 0.2.0 — release checklist

## Product scope
- [x] Mobil öncelikli, sade Türkçe arayüz.
- [x] Ses dosyası ve video dosyası ekleme akışları ayrı sekmelerde.
- [x] MP3, M4A, WAV, OGG, AAC ve FLAC ses dosyalarını yerel arşive ekleme.
- [x] Desteklenen MP4/MOV dosyalarından AAC ses akışını görüntüden ayırıp M4A olarak kaydetme.
- [x] IndexedDB üzerinde cihaz içi ses arşivi.
- [x] Uygulama içinden oynatma, duraklatma, ileri-geri sarma ve zaman çizgisi.
- [x] Dalga formu üzerinden ses kesme; kesiti WAV olarak kaydetme.
- [x] Orijinali koruma veya kesit sonrası silme seçeneği.
- [x] ZIP yedekleme ve Ses Cebi yedeğini geri yükleme.
- [x] Kayıt indirme ve arşivden silme.

## PWA ve gizlilik
- [x] Web App Manifest, PNG/SVG ve maskable ikonlar.
- [x] Service Worker uygulama kabuğu ile gerçek JS/CSS varlıklarını önbelleğe alır.
- [x] Sürüm kontrollü önbellek güncellemesi.
- [x] Harici font isteği yok; arayüz sistem yazı tiplerini kullanır.
- [x] Medya dosyaları cihazdaki IndexedDB alanında tutulur; uygulama sunucusuna yüklenmez.
- [x] Kullanım/telif, gizlilik/depolama ve kullanım koşulları bilgilendirmesi.
- [x] ozgulerforge.com.tr ve iletisim@ozgulerforge.com.tr iletişim bilgileri.

## Teknik iyileştirmeler
- [x] Ses kesitinin kaydı ve orijinalin silinmesi işlemleri ayrı ayrı doğrulanır.
- [x] IndexedDB yazma/silme işlemlerinde transaction tamamlanması beklenir.
- [x] Yeniden adlandırma ve paylaşma gibi ana akış dışı kontroller ana listeden kaldırıldı.
- [x] Kullanılmayan eski TypeScript uygulama kopyası kaldırıldı; tek kaynak `main.js` ve `styles.css`.
- [x] Vite derlemesi alt dizinlerde yayınlanabilmesi için göreli base kullanır.

## Bilinen sınırlar / yayın öncesi test
- Video ayrıştırma hedefi AAC ses içeren MP4/MOV dosyalarıdır. Diğer kodekler, parçalı MP4 ve bazı MOV varyantları tarayıcıya bağlı olarak başarısız olabilir.
- Ses kesme, Web Audio API ile bellekte çözümlenir; 15 dakikadan uzun kayıtlar için kapalıdır.
- Arka planda oynatma ve kilit ekranı kontrolleri cihaz/tarayıcı desteğine bağlıdır.
- PWA kurulum ve çevrimdışı testleri HTTPS üzerinde gerçek Android ve iOS cihazlarda yapılmalıdır.
- Bu teslimde `npm run check` ile JavaScript sözdizimi kontrolü yapılmıştır. Bağımlılık kurulumu zaman aşımına uğradığı için `npm run build` ve gerçek cihaz testleri tamamlanamamıştır.
