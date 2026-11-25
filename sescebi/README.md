# Ses Cebi 0.4.1 (uygulama sürümü 36)

ozguler forge tarafından geliştirilen, sesleri cihazda saklayan ve çevrimdışı dinlemeye odaklanan PWA.

## Özellikler
- Ses/video dosyası, doğrudan bağlantı veya izinli X videosundan ses ekleme (videodan ses: MP4/MOV içindeki AAC doğrudan ayrılır; diğerleri tarayıcı çözücüsüyle MP3'e, olmazsa WAV'a çevrilir)
- IndexedDB üzerinde yerel arşiv: arama, favoriler, sıralama
- Klasörler: Şiir, Müzik, Hayata dair. Sesler eklenirken ya da sonradan (⋯ → Klasöre taşı) etiketlenir; arşivde klasör çubuğundan süzülür, ZIP yedekte klasör klasör saklanır
- Tümünü dinle: görünen liste (klasör, arama, favori, sıralama) baştan sona sırayla çalınır
- X ve bağlantı alanlarında tek dokunuşla temizleme (×)
- Oynatma: önceki/sonraki, tekrar/karıştırma, hız, uyku zamanlayıcısı
- Stüdyo: dalga formunda kesme, yakınlaştırma, fade-in/out, bas/tiz, WAV dışa aktarma
- ZIP yedekleme/geri yükleme; isteğe bağlı Google girişiyle favori ve dinleme istatistiklerini Cloudflare Worker + KV üzerinde yedekleme (ses dosyaları buluta gitmez)
- PWA kurulumu, çevrimdışı kabuk, Android paylaş menüsünden dosya alma
- Sistem temasını izleyen açık/koyu tema; dış font kullanılmaz (sistem yazı tipi)

## Geliştirme
Node.js 20+ yeterlidir; npm bağımlılığı yoktur.

```bash
npm run check    # sözdizimi + sürüm eşitliği + arayüz id denetimi
npm run build    # check + dist/ klasörüne statik paket
npm run dev      # http://localhost:4173 (kök klasör)
npm run preview  # dist/ klasörünü sunar
```

HTTPS üzerinden yayınlayın (Service Worker için gerekir).

## Dosyalar
| Dosya | Görev |
|---|---|
| `index.html` | Tek giriş sayfası |
| `main.js` | Uygulama mantığı ve arayüz şablonu |
| `cloud-sync.js` | İsteğe bağlı Google ile bulut eşitleme (ES modülü) |
| `app.css` | Tek stil dosyası (renkler `:root` değişkenlerinde) |
| `sw.js` | Service Worker (çevrimdışı kabuk, paylaşım hedefi) |
| `lame.min.js` | MP3 kodlayıcı |
| `manifest.webmanifest`, `icons/` | PWA kimliği |
| `manus-routes.json` | Manus barındırma yönlendirmesi (başka yerde yayınlıyorsanız silinebilir) |

## Sürüm yayınlama
1. `main.js` içindeki `APP_VERSION` ve `sw.js` içindeki `VERSION` değerini birlikte artırın (`npm run check` farkı yakalar).
2. `npm run build` ve `dist/` klasörünü yayınlayın.

Dosya adlarında `?v=` gibi sürüm eki yoktur. Sayfa, betik ve stil dosyaları Service Worker tarafından önce ağdan alınır, bu yüzden güncellemeler ek bir işlem gerektirmeden gelir.

## Teknik notlar
- Arşiv tarayıcı depolamasındadır; tarayıcı verisi silinirse kaybolabilir. Düzenli ZIP yedeği alın.
- `cloud-sync.js` içindeki `GOOGLE_CLIENT_ID` ve Worker adresi, Cloudflare/Google Cloud tarafındaki kayıtlarla aynı olmalıdır.
- X video çözümleme `api.fxtwitter.com` ve `*.twimg.com` adreslerine erişir; gizli/kısıtlı gönderiler desteklenmez.
- Arka plan ve kilit ekranı davranışı işletim sistemi/tarayıcı kısıtlarına bağlıdır.
- Hukuki metinler (Kullanım Koşulları, Gizlilik, KVKK Aydınlatma, Sorumluluk Reddi) `main.js` içinde “legal-overlay” bölümündedir. Genel bilgilendirmedir; veri sorumlusunun unvan/adres bilgisi eklenmeli ve yayından önce bir avukata gösterilmelidir.

## İletişim
https://ozgulerforge.com.tr · iletisim@ozgulerforge.com.tr
