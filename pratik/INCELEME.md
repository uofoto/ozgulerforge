# Pratik uygulaması — inceleme ve düzeltme özeti

## Bulunan sorunlar ve yapılan düzeltmeler

| Alan | Önceki sorun | Düzeltme |
|---|---|---|
| QR | Gerçek QR yerine taranamayan örnek desen üretiyordu. | Çevrimdışı çalışan MIT lisanslı modülle standart QR üretimi eklendi. |
| JPG→PDF | Yalnızca ilk fotoğraf kullanılıyordu. | Seçilen her görsel için ayrı sayfalı PDF üretimi, sayfa yönü ve çıktı adı düzeltildi. |
| PDF/video araçları | İşlem yapmadan “hazır/tamamlandı” mesajı ve sahte çıktı kartı gösteriyordu. | Hazır olmayan araçlar “Yakında” olarak işaretlendi ve işlem düğmeleri devre dışı bırakıldı. |
| Araç rotaları | Araç değişince eski dosya ve çıktı ekranda kalabiliyordu. | Hash rota değişiminde geçici dosya ve çıktı durumları temizleniyor. |
| Görsel seçenekleri | Sıkıştırma KB hedefleri yanlış uygulanıyor; vesikalık ölçü/arka plan ayarı çıktıyı etkilemiyordu. | 50/100 KB hedefleri ve seçilebilir oran/arka plan davranışı düzeltildi; ulaşılamayan sıkıştırma hedefi ayrıca belirtiliyor. |
| Sağlamlık | Dosya MIME türü, video karesi yakalama temizliği ve hata sonrası kilitlenen düğme sorunları vardı. | Tür kontrolü genişletildi, video geçici kaynakları kapatılıyor, hata halinde işlem düğmesi yeniden etkinleşiyor; yerel depolama hatası oturumu çökertmiyor. |
| İçerik doğruluğu | Araç kartları bazı özellikleri gerçekte olduğundan geniş vaat ediyordu. | Kartlar, ana sayfa ve yasal kapsam metinleri mevcut işlevleri daha doğru anlatacak şekilde güncellendi. |

## Bu sürümde çalışan işlemler

Görsel dönüştürme, yeniden boyutlandırma, yeniden dışa aktararak metadata temizleme, kalite/boyut küçültme, basit düz arka plan şeffaflaştırma, yaklaşık alanı maskeleme, oran kırpma; gerçek QR üretimi; bir veya daha fazla görselden PDF üretme; desteklenen video biçimlerinde kare yakalama.

Arka plan temizleme basit köşe rengi yaklaşımı kullanır; yüz/plaka aracı otomatik tanıma yapmaz ve yaklaşık bir bölgeyi maskeler. HEIC desteği tarayıcıya bağlıdır. Video codec işlemleri ile PDF birleştirme, bölme, PDF→JPG ve imza bu sürümde hazır değildir; arayüzde açıkça belirtilir.

## Yasal metinler

Hakkımızda, Gizlilik Politikası, Kullanım Koşulları ve İletişim sayfalarının tümünde şu bilgiler ortak yayıncı/iletişim alanında yer alır: **https://ozgulerforge.com.tr** ve **iletisim@ozgulerforge.com.tr**.

Yayın öncesinde işletmenin tam ticari/yasal unvanı, tebligat adresi ve gerekiyorsa sicil/vergi bilgileri eklenmeli; barındırma sağlayıcısının teknik günlük kapsamı/saklama süresi ile gerçek veri akışları işletmeci tarafından doğrulanmalıdır. Kaynakta bulunmayan bilgiler uydurulmadı. Ayrıntı için `LEGAL-INFO-NEEDED.md` dosyasına bakın. Bu inceleme hukuki danışmanlık değildir.

## Doğrulama

`npm run check` JavaScript sözdizimi kontrolünden, `npm run build` yayın kopyası üretiminden geçti. Tarayıcıda QR PNG çıktısı, iki görselli/iki sayfalı PDF ve hazır olmayan PDF aracının devre dışı durumu denendi.
