# Ses Cebi Premium 0.2.0

ozguler forge tarafından geliştirilen, sesleri cihazda saklayan ve çevrimdışı dinlemeye odaklanan PWA.

## Özellikler
- Ses dosyalarını arşive ekleme; desteklenen MP4/MOV dosyalarında AAC akışını ayırma, diğer desteklenen videolarda tarayıcı çözücüsüyle WAV oluşturma
- IndexedDB üzerinde yerel ses arşivi, arama, favoriler ve sıralama
- Oynatma, önceki/sonraki, tekrar/karıştırma, hız ayarı ve uyku zamanlayıcısı
- Dalga formu üzerinden yakınlaştırma, sürükleyerek aralık ayarlama, WAV kesit kaydı, bas/tiz filtresi ve fade-in/fade-out
- ZIP yedekleme ve geri yükleme (favori bilgisi dahil)
- İsteğe bağlı Google girişiyle favori ve dinleme istatistiklerini Cloudflare (Worker + KV) üzerinde yedekleme; ses dosyaları buluta gönderilmez
- PWA kurulum ve çevrimdışı uygulama kabuğu
- Açık/koyu tema
- X videosu sekmesi: herkese açık gönderilerden video bulma, kalite seçme, videoyu indirme ve videonun sesini arşive ekleme

## Geliştirme ve derleme
Node.js 20+ önerilir. Projede üçüncü taraf npm bağımlılığı yoktur.

```bash
npm run check
npm run build
npm run dev
```

Üretim çıktısı `dist/` klasörüdür. Önizleme için `npm run preview` kullanın. HTTPS üzerinden yayınlayın.

## Teknik notlar
- Ses arşivi cihazın tarayıcı depolamasında tutulur; tarayıcı verisi silinirse kaybolabilir. Düzenli ZIP yedeği alın. Favori ve istatistikler, Google ile giriş yapılmışsa buluttan geri yüklenir.
- Kesit dışa aktarma WAV'dır. MP3/M4A kodlama bu sürümde yoktur; kaynak dosyanın özgün biçimi indirme/paylaşmada korunur.
- Video ses ayrıştırma tüm konteyner/kodekleri desteklemez. MP4/MOV içindeki standart AAC akışı doğrudan ayrıştırılabilir; diğer biçimler tarayıcının Web Audio çözücüsüne bağlıdır.
- Arka plan ve kilit ekranı davranışı işletim sistemi/tarayıcı kısıtlarına bağlıdır.
- X video çözümleme, herkese açık gönderiler için `api.fxtwitter.com` ve `*.twimg.com` adreslerine ihtiyaç duyar; gizli/kısıtlı içerik desteklenmez.
- Hukuki metinler genel bilgilendirmedir; KVKK aydınlatma metni ve veri sorumlusu bilgileri işletmeci tarafından hukuk danışmanlığıyla tamamlanmalıdır.

## İletişim
https://ozgulerforge.com.tr · iletisim@ozgulerforge.com.tr
