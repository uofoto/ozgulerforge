# Pratik PWA

Modern, mobil uyumlu ve kurulabilir dosya araçları uygulaması.

## Geliştirme

```bash
npm run check
npm run build
npm run dev
```

`npm run build`, statik yayın dosyalarını `public/` klasörüne kopyalar. Yerel deneme için `npm run dev` sonrasında `http://localhost:3000` adresini açın.

## Yayın

Statik hosting kullanıyorsanız `public/` klasörünün İÇERİĞİNİ uygulamanın yayın dizinine yükleyin. Örneğin `/pratik/` altında yayınlamak için `public/` içindeki dosyaları `/pratik/` dizinine yerleştirin. `index.html`, `app.js`, `styles.css`, `qrcode.mjs`, `sw.js`, `manifest.webmanifest`, ikonlar ve `manus-routes.json` aynı yayın dizininde bulunmalıdır.

## Not

Tüm araç kartları katalogda listelidir; ancak bu sürümde 11 araç gerçek çıktı üretir. Diğer 9 araç, sahte işlem sonucu göstermemek için devre dışıdır. Ayrıntılar `TEKNIK-INCELEME.md` dosyasındadır.
