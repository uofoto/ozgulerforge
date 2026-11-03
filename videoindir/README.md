# Video İndirici (PWA)

Tweet bağlantısını yapıştırıp videoyu indiren, telefona kurulabilen küçük bir web uygulaması. Sunucu gerektirmez; tamamen statik dosyalardan oluşur.

## Nasıl çalışır

1. Bağlantıdan tweet ID'si çıkarılır.
2. Tweet verisi `api.fxtwitter.com` üzerinden alınır (CORS açık, anahtar gerekmez).
3. Videonun doğrudan MP4 adresi listelenir; **İndir** ile cihaza kaydedilir.
   - iPhone'da paylaşım sayfası açılır, "Videoyu Kaydet" seçilir.
   - Tarayıcı doğrudan indirmeye izin vermezse video yeni sekmede açılır (uzun bas → kaydet).

## Çalıştırma

PWA kurulumu için HTTPS gerekir (`localhost` hariç).

```bash
cd x-video-indir
python3 -m http.server 8080
# http://localhost:8080
```

Yayınlamak için klasörü olduğu gibi GitHub Pages, Netlify veya Cloudflare Pages'e yükleyebilirsin.

## Kurulum ve paylaşım

- **Android (Chrome):** Menü → "Uygulamayı yükle". Kurulunca X/Twitter uygulamasında Paylaş → "Video İndir" ile bağlantı doğrudan uygulamaya düşer (`share_target`).
- **iPhone (Safari):** Paylaş → "Ana Ekrana Ekle". iOS, paylaşım hedefi desteklemediği için bağlantıyı yapıştırman gerekir.

## Bilinen sınırlar

- Üçüncü taraf `fxtwitter` servisine bağlıdır; servis değişirse `app.js` içindeki `API` sabiti güncellenmelidir.
- Gizli hesaplar, silinmiş veya yaş kısıtlı tweetler çalışmayabilir.
- Sadece indirme hakkın olan içerikler için kullan.

## Dosyalar

| Dosya | Görev |
|---|---|
| `index.html` | Arayüz |
| `app.js` | Bağlantı çözme, API çağrısı, indirme |
| `sw.js` | Çevrimdışı kabuk önbelleği |
| `manifest.webmanifest` | Kurulum ve paylaşım hedefi |
| `icons/` | Uygulama simgeleri |
