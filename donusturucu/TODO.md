# Yapılacaklar

## İlk kullanıcı talebi: tüm biçimlerde kayıpsız dönüşüm
- [ ] “bilinen tüm video ve resim formatlarını birbirine kayıpsız dönüştürme.” Bu uygulama sürümü tüm bilinen biçimleri kapsamıyor; tarayıcıda çözülebilen girdiler ve sınırlı yerel kodlayıcılarla çalışıyor. Bu gereksinim tamamlanmış sayılmıyor.

## Dosya içe aktarma ve format seçimi
- [x] Uygulama, resim ve video dosyalarını sürükle-bırak veya dosya seçiciyle içe aktarmalıdır.
- [ ] Yaygın ve mümkün olduğunca geniş resim/video formatları arasında kaynak-hedef format seçimi sunmalıdır; tarayıcı/codec tarafından desteklenmeyen formatları destekleniyormuş gibi göstermemeli ve uyumluluk sınırlarını açıkça belirtmelidir. Mevcut hedefler: tarayıcı kodlayıcısı desteklerse PNG/JPEG/WebP/AVIF; video için tarayıcıda desteklenen WebM/VP8–VP9. Evrensel FFmpeg-türü biçim kapsamı yoktur.

## Dönüştürme seçenekleri ve kalite davranışı
- [x] Kodek, çözünürlük, kare hızı, bit hızı, kalite ve şeffaflık gibi formata uygun çıktı ayarları sunulmalıdır. Video kare hızı 24/30/60 fps seçenekleridir; kaynak FPS’i okunmuyor.
- [x] Teknik olarak desteklenen dönüşümlerde kayıpsız mod, diğer dönüşümlerde en yüksek kalite seçeneği ve açık uyumluluk uyarıları sunulmalıdır. Kaynak özellikleri hedef biçimde korunamıyorsa kayıpsız olduğu iddia edilmemelidir. PNG kodlaması kayıpsızdır; canvas yeniden-işleme metadata ve renk profili korumayı garanti etmez; video yeniden kodlaması kayıpsız değildir.

## Kuyruk, ilerleme ve çıktı
- [x] Birden fazla dosya kuyrukta toplu dönüştürülebilmeli ve işlem ilerlemesi dosya bazında gösterilmelidir.
- [x] Dönüşüm öncesi dosya bilgileri ile tahmini çıktı boyutu görüntülenmelidir. Tahminler yaklaşıktır.
- [x] Tamamlanan çıktılar tek tek veya toplu paket halinde indirilebilmelidir. Bellek güvenliği için ZIP paketi 128 MB ile sınırlıdır; daha büyük çıktılar tek tek indirilebilir.

## PWA deneyimi
- [x] Uygulama duyarlı olmalı, çevrimdışı açılabilmeli ve cihaz ana ekranına kurulabilen PWA sunmalıdır. Çevrimdışı kabuk service worker önbelleğine dayanır; ilk kez çevrimdışı kullanım için uygulamanın önce çevrimiçiyken açılmış olması gerekir.
