# Ses Cebi · ozguler forge

Mobil öncelikli, yerel depolamalı kişisel ses arşivi ve PWA.

## Temel akış

- **Ses dosyası:** Kullanıcının seçtiği MP3, M4A, WAV, OGG, AAC veya FLAC dosyası cihazdaki IndexedDB arşivine kaydedilir.
- **Videodan ses çıkar:** 50 MB sınırındaki MP4/MOV dosyalarındaki desteklenen AAC ses akışı görüntüden ayrıştırılır ve M4A olarak arşive eklenir. Video görüntüsü saklanmaz. AAC dışı veya parçalı MP4/MOV dosyaları her tarayıcıda desteklenmeyebilir; bu durumda uygulama hata bildirir.
- **Dinle:** Arşivdeki sesler uygulama içindeki oynatıcıdan çalınabilir. PWA çevrimdışı kullanım için uygulama kabuğunu önbelleğe alır.
- **Kes:** Dalga formu üzerinden seçilen bölüm WAV olarak yeni kayıt oluşturur. İstenirse orijinal kayıt korunur.
- **Yedek:** Arşiv ZIP olarak dışa aktarılabilir ve uygulamanın oluşturduğu yedek geri yüklenebilir.

## Veri ve gizlilik

Ses dosyaları tarayıcı IndexedDB alanında cihaz üzerinde saklanır; uygulama hesabı veya medya yükleme sunucusu yoktur. Tarayıcı verilerinin silinmesi veya uygulama verilerinin kaldırılması kayıtları silebilir. Kullanıcıların düzenli yedek alması önerilir.

Uygulama yalnızca kullanma ve işleme hakkı bulunan medya dosyaları için kullanılmalıdır. Uygulama telif lisansı sağlamaz.

## Geliştirme

```bash
npm install
npm run dev
npm run check
npm run build
npm run preview
```

`main.js` ve `styles.css` uygulama arayüzünün kaynak dosyalarıdır. `public/manifest.webmanifest`, `public/sw.js` ve `public/icons/` PWA kurulum/çevrimdışı dosyalarıdır. `sw.js` kökte geliştirme sunucusu için eş kopyadır; iki service worker dosyası sürüm artırımlarında birlikte güncellenmelidir.

## Sınırlamalar

- PWA kurulumu ve çevrimdışı çalışma için HTTPS gerekir (localhost geliştirme istisnası).
- Arka planda oynatma ve kilit ekranı kontrolleri tarayıcı/işletim sistemi desteğine bağlıdır.
- Ses kesme, Web Audio API ile bellekte çözümlenen dosyalarda çalışır; 15 dakikadan uzun sesler için kesme devre dışıdır.
- Video ayrıştırma sürümünde hedef biçim AAC ses içeren MP4/MOV'dur.

## İletişim

- https://ozgulerforge.com.tr
- iletisim@ozgulerforge.com.tr
