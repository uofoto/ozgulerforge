# İzsiz Foto 2.9.0 — seçmeli temizleme

- Fotoğraf/video seçilince artık **otomatik temizlik yapılmaz**. Dosya önizlenir ve hemen altında silinebilecek veri türleri listelenir.
- Liste yalnızca dosyada **gerçekten bulunan** türleri gösterir (boyutu ve içeriğiyle): Konum (GPS), Cihaz/lens/seri no, Yazılım/sahip/açıklama, Tarih ve saat, Çekim ayarları, MakerNote, Gömülü küçük resim, XMP, IPTC, Yorum, PNG metin alanları, Yapay zekâ üretim kayıtları (prompt/parametreler), C2PA içerik kökeni, ICC, Dosya sonu ekleri.
- İstediklerini işaretleyip **TEMİZLE**'ye basınca yalnızca işaretlenenler silinir; diğerleri korunur ("Korundu: …" etiketiyle gösterilir). Birden çok dosyada **Hepsini TEMİZLE** düğmesi vardır.
- EXIF kısmen korunabilir (ör. yalnızca konumu sil, cihaz bilgisini bırak). Yön ve ColorSpace her zaman kalır; görüntü yeniden kodlanmaz.
- HEIC/HEIF: dönüştürmede üstveri zaten taşınmaz; kart bunu belirtir ve TEMİZLE ile dönüştürür. Video: tek "Video üstverisi" seçeneği.
- Ayarlar'dan kalkanlar: "Renk profilini koru", "Çekim tarihini koru", "Dosya sonu eklerini sil", "C2PA'yı koru" (artık her dosyanın altında seçiliyor). Varsayılanlar eskisiyle aynıdır (ICC kalır, diğerleri silinir).
- Deneysel piksel işlemi ve doğrulama mantığı değişmedi.
