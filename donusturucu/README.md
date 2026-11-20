# Kontak — kayıpsız resim ve video dönüştürücü (PWA)

Tamamen tarayıcıda çalışır (ffmpeg.wasm 0.12 / FFmpeg 5.1.4). Dosyalar cihazdan çıkmaz, ilk açılıştan sonra çevrimdışı çalışır.
Her dönüşümden sonra kaynak ve çıktının her karesi yeniden çözülüp özetleri (md5) karşılaştırılır; ses de aynı şekilde.

## Çalıştırma
Statik bir sunucu yeterli (servis çalışanı için `localhost` veya HTTPS gerekir):

    cd donusturucu
    python3 -m http.server 8765      # sonra http://localhost:8765

`vendor/core/ffmpeg-core.wasm` (32 MB) depoda/zip'te bulunmaz; `@ffmpeg/core@0.12.9` paketinin ESM yapısından alınıp `vendor/core/` içine konmalıdır. Yoksa motor yüklenemez.

Yayınlamak için klasörü olduğu gibi herhangi bir statik barındırmaya koyun. `ffmpeg-core.wasm` (32 MB) için sunucuda brotli/gzip açın.
Çekirdek tek iş parçacıklıdır; COOP/COEP başlığı gerekmez.

## Desteklenenler
- Girdi: FFmpeg'in çözebildiği her resim/video (JPEG, PNG, TIFF, BMP, GIF, APNG, WebP, JPEG 2000, QOI, TGA, PNM, EXR, MP4, MOV, MKV, AVI, WebM, FLV, TS ...). HEIC/AVIF/JXL için tarayıcı çözücüsü denenir (8 bit sRGB).
- Resim hedefleri: PNG, WebP (kayıpsız), TIFF, JPEG 2000, BMP, QOI, PAM, TGA; kayıplı: JPEG, GIF.
- Video hedefleri: MKV·FFV1, AVI·FFV1, MP4·H.264 (qp 0), MOV·H.264, MKV·H.264.
- Hareketli: APNG, animasyonlu WebP, GIF (kayıplı). Kare dizisi: PNG/TIFF ZIP.

## Dürüst sınırlar (test edilerek bulundu)
- **WebM·VP9 kapalı:** bu wasm derlemesinde VP9 kodlayıcı birkaç kareden sonra çöküyor. WebM girdi olarak okunur.
- **16 bit JPEG 2000** bu çekirdekte kayıpsız değil; uygulama reddeder (PNG/TIFF kullanın). 8 bit doğrulandı.
- Kayıpsız = kaynağın *çözülmüş* pikselleri birebir. JPEG gibi kayıplı kaynağın kaybı geri gelmez.
- Ses mümkünse kopyalanır; sığmazsa ALAC/PCM. Animasyonlu WebP çıktısı ffmpeg okuyamadığı için uygulama içinde doğrulanamaz.
- ICC profili ve EXIF resimlere taşınmaz. Kayıpsız H.264 (High 4:4:4 Predictive) her oynatıcıda açılmaz (VLC/mpv açar).
- Çıktı bellekte üretilir; ~2 GB üstü işler başarısız olabilir. Animasyonlu WebP girdisi desteklenmez.

## Yapı
`js/formats.js` planlayıcı (hedef → ffmpeg argümanları + uyarılar), `js/engine.js` ffmpeg sarmalayıcısı (probe, çalıştırma, doğrulama),
`js/app.js` arayüz, `sw.js` çevrimdışı önbellek, `vendor/` ffmpeg.wasm dosyaları.
