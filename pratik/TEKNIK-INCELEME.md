# Pratik PWA — Teknik teslim notları

## Bu revizyonda yapılanlar
- Kullanıcının gönderdiği Filee ekranına yakın koyu üst navigasyon + açık renkli geniş çalışma/karşılama paneli tasarımı uygulandı.
- Format tekeri görseli, masaüstü ve mobil navigasyon, araç kartları, form alanları ve çalışma alanları yeni görsel dile uyarlandı.
- Tema tercihi doğrulanarak yüklenir; tema rengi PWA meta etiketine de yansıtılır.
- Araç/ekran değişimlerinde geçici dosya URL'leri iptal edilerek bellek sızıntısı azaltıldı.
- Görsel sıkıştırmada boyut azaltma adımları orijinal en-boy oranını koruyacak şekilde düzeltildi.
- Dosya başına 150 MB, toplu dosya işlemlerinde 300 MB sınırı eklendi.
- Service worker önbelleği v7'ye yükseltildi; yeni sürümün eski uygulama kabuğunda takılı kalması önlendi.
- `public/` dizini `npm run build` ile kaynak dosyalardan yeniden üretildi.

## Gerçekten çalışan araçlar
- Görsel: Metadata temizleme (yeniden dışa aktarma), boyut küçültme, HEIC→JPG (tarayıcı HEIC açabiliyorsa), format dönüştürme, basit düz arka plan şeffaflaştırma, yaklaşık alan gizleme, oran kırpma/vesikalık çıktısı, piksel boyutlandırma.
- Diğer: QR kod üretimi.
- Video: Videodan kare yakalama (tarayıcı codec desteğine bağlı).
- PDF: Bir veya birden fazla görselden çok sayfalı PDF oluşturma.

## Henüz etkin olmayan araçlar
Videodan MP3, video sıkıştırma, video kırpma, video→GIF, video metadata temizleme, PDF birleştirme, PDF bölme, PDF→JPG ve PDF imzalama. Bu araçlar sahte sonuç üretmemesi için devre dışı gösterilir. Bunları tam işlevli yapmak için tarayıcıda çalışan FFmpeg/WebAssembly ve PDF işleme motorları, bunların lisans/dağıtım dosyaları ve gerçek cihaz testleri ayrıca gereklidir.

## Kontroller
- `npm run check`: JavaScript sözdizimi kontrolü.
- `npm run build`: yayın kopyasını `public/` içine üretir.
- `public/` içindeki uygulama dosyaları build sonrası kaynaklarla eşleştirilmiştir.

## Yayın öncesi
- Gerçek iOS Safari, Android Chrome ve masaüstü tarayıcılarında PWA kurulum/çevrimdışı açılış testi yapılmalı.
- HEIC ve video codec desteği cihazdan cihaza değişir.
- Hukuki metinlerde işletmenin tam yasal unvanı, adresi ve veri işleme/hosting bilgileri işletmeci tarafından doğrulanmalıdır.
