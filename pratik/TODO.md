# Pratik PWA TODO

## 1. Mobil uygulama kabuğu ve PWA kurulumu
- [x] Kullanıcının verdiği `index.html` temel alınarak Türkçe, mobil öncelikli bir uygulama kabuğu oluştur.
- [x] PWA manifesti, standalone görüntüleme, tema rengi, ikon ve uygulama adı ekle.
- [x] Service worker ile uygulama kabuğunu cache’le ve bağlantı yokken ana ekranı aç.
- [x] Mobil alt navigasyon, masaüstü yan menü, kurulum banner’ı, tema seçimi ve erişilebilir buton durumları ekle.

## 2. 20 aracın katalog ve gezinme deneyimi
- [x] Görsel kategorisinde Metadata Temizle, Boyut Küçült, HEIC → JPG, Format Dönüştür, Arka Plan Sil, Yüz / Plaka Gizle, Vesikalık Fotoğraf ve Boyutlandır araçlarını göster.
- [x] Video kategorisinde Videodan MP3, Video Sıkıştır, Video Kırp, Video → GIF, Kare Yakala ve Video Konum Sil araçlarını göster.
- [x] Diğer kategorisinde QR Kod Oluştur aracını göster.
- [x] PDF kategorisinde PDF Birleştir, PDF Böl, PDF → JPG, JPG → PDF ve PDF İmzala araçlarını göster.
- [x] Arama, kategori filtresi, son kullanılan araçlar ve araç detay çalışma alanı ekle.

## 3. Cihaz-içi dosya çalışma akışları
- [x] Dosya seçme, sürükle-bırak alanı, dosya kuyruğu, dosya boyutu bilgisi ve temizleme aksiyonu ekle.
- [x] Görsel işlemlerinde Canvas tabanlı format dönüştürme, kalite/boyutlandırma, metadata temizleme için yeniden dışa aktarma ve vesikalık oranı üretimini uygula.
- [x] Video aracında yerel önizleme ve desteklenen gerçek kare yakalama çıktısını uygula.
- [x] QR, PDF ve video araçları için aynı dosya çalışma alanı, işlem durumu ve güvenli çıktı geri bildirimi sun.
- [x] Sonuç indirme bağlantısı, işlem sayısı ve son işlemler geçmişini cihazda tut; dosya içeriğini saklama.

## 4. Güven, içerik ve kalite
- [x] Ana ekranın gizlilik, üyelik yok, ücretsiz ve çevrimdışı çalışma vaatlerini görünür kıl.
- [x] SSS, “dosya neden yüklenmiyor?” açıklaması ve gizlilik durum kartı ekle.
- [x] Responsive 375px mobil, tablet ve masaüstü düzenlerini destekle.
- [ ] Gerçek PDF birleştirme/bölme ve tam video codec işlemleri için ayrı, tarayıcı içi WASM modüllerini sonraki iterasyonda ekle.

## 5. Yasal metinler ve iletişim
- [x] Uygulama içinde Hakkımızda, Gizlilik Politikası, Kullanım Koşulları ve İletişim sayfalarını ekle.
- [x] Yasal metinlerde web adresini `https://ozgulerforge.com.tr` ve iletişim adresini `iletisim@ozgulerforge.com.tr` olarak kullan.
- [x] Ana sayfa footer’ında yasal navigasyon, alan adı ve telif bilgisini göster.
