<p align="center">
  <img src="icons/icon-192.png" alt="hadiGET logosu" width="96" height="96">
</p>

# hadiGET

Telefonla bilgisayar arasında dosya aktarmanın en kısa yolu. Ücretsiz, açık kaynak, **hesap yok, yükleme yok**: dosyalar iki cihaz arasında doğrudan (WebRTC) akar. Cihazlar birbirini kendiliğinden bulur; birine dokunup diğerinde "Kabul et"e basman yeter.

Tarayıcıda çalışan bir PWA'dır; kurulum gerekmez, ana ekrana eklenir. İlk açılıştan sonra internet olmadan da çalışır.

*English: hadiGET is an open-source PWA for sending files between your phone and computer over WebRTC. Devices on the same network find each other automatically (tap a device, accept on the other side). Files never touch a server; a tiny Cloudflare Worker only relays the pairing info. No account, nothing is uploaded.*

Geliştirici: [Özgüler Forge](https://ozgulerforge.com.tr) · İletişim: [iletisim@ozgulerforge.com.tr](mailto:iletisim@ozgulerforge.com.tr)

## Nasıl kullanılır

1. İki cihazı **aynı Wi-Fi**'a bağla, hadiGET'i ikisinde de aç.
2. Ana ekrandaki **Yakındaki cihazlar** listesinde diğer cihazı gör ve ona dokun.
3. Diğer cihazda **Kabul et**'e bas. Bağlandınız.
4. Dosya seç ya da sürükle bırak; kısa metin ve bağlantı da gönderebilirsin. Gelen dosyada **Kaydet**'e bas.

Cihaz listede görünmüyorsa (farklı ağ, misafir Wi-Fi, bir cihazın IPv6, diğerinin IPv4 kullanması): iki cihazda da **Kodla bağlan**'a bas, birinde **Yeni kod oluştur**, diğerine o 6 haneli kodu yaz.

**Yedek yol (eşleştirme sunucusu olmadan):** ana ekrandaki **QR ile bağlan** bölümü. Bir cihazda *Bağlantı başlat*, diğerinde *Bağlantıya katıl*; iki QR kod okutulur (ya da iki kısa kod yapıştırılır). İnternet yokken de çalışır.

Ayrıntılı kılavuz, ana ekrana ekleme adımları ve sorun giderme tablosu uygulamanın içinde: [`nasil-kullanilir.html`](nasil-kullanilir.html).

## Özellikler (v1.2)

- **Paylaş menüsünden gönder:** uygulama kurulunca galeri/dosya yöneticisinden *Paylaş ▸ hadiGET* (Web Share Target; hizmet çalışanı gerekir, yani HTTPS'te yayında çalışır).
- **Yapıştır ve fotoğraf çek:** bilgisayarda Ctrl+V ile görsel, telefonda doğrudan kamera.
- **Önizleme:** gelen/giden görsel, video, ses ve metin dosyaları listede görünür.
- **Çizim editörü:** görselde *Düzenle*: kalem, fosforlu, ok, kutu, metin; sonra *Kaydet* ya da *Karşıya gönder*.
- **Hız ve kalan süre, iptal:** iki taraf da sürmekte olan aktarımı iptal edebilir.
- **Büyük dosya:** 64 MB üstü dosyalar belleğe değil tarayıcının özel disk alanına (OPFS) yazılır.
- **Klasör / çoklu seçim → zip** (sıkıştırmasız, 4 GB'a kadar).
- **Güvenilen cihaz** (isteğe bağlı otomatik kabul), **cihaz adı**, **ses/titreşim/bildirim**, **oturum geçmişi** (yalnızca bellekte), **Türkçe/İngilizce** arayüz.

Sürüm numarası tek yerde: `version.js`. Yayında değişiklik yaptığında onu artır (önbellek adı ondan türetilir).

## Gizlilik ve yasal metinler

- Dosyalar hiçbir sunucuya yüklenmez; iki cihaz arasında şifreli (DTLS) bir kanaldan geçer.
- Cihazların birbirini bulması için `worker/` klasöründeki küçük bir Cloudflare Worker kullanılır. Yalnızca "kim var" listesini ve kısa bağlantı kodlarını iletir, kalıcı hiçbir şey saklamaz; bağlantı kurulunca devreden çıkar. Aynı ağdaki cihazlar IP adresinin tek yönlü özetiyle aynı odaya konur. Dosyalar ve metinler oradan geçmez. QR yedek yolunda bu sunucuya hiç başvurulmaz.
- Gelen bağlantı isteği, sen **Kabul et**'e basmadan kurulmaz.
- Hesap, reklam, analiz ya da izleme aracı yoktur.
- Eşleştirme sunucusu dışında sayfa yüklendikten sonra **hiçbir dış hizmete** başvurulmaz. Yalnızca "Farklı ağlardayız" kutusunu işaretlersen ya da "Kodla bağlan"ı kullanırsan, genel adresini öğrenmek için Google'ın STUN sunucusuna (`stun.l.google.com`) küçük bir istek gider; dosya içeriği oraya gitmez.

Metinler uygulamanın içinde, Türkçe ve İngilizce: [`gizlilik.html`](gizlilik.html) (Gizlilik Politikası ve KVKK Aydınlatma Metni), [`kosullar.html`](kosullar.html) (Kullanım Koşulları).

> Bu metinler genel bir şablon değil, uygulamanın gerçek davranışına göre yazıldı; yine de yayına almadan önce bir hukukçuya gösterilmesi önerilir. Yayın yerini (barındırma hizmeti) değiştirirsen `gizlilik.html` içindeki "Barındırma hizmeti" maddesini güncelle.

## Sınırlar (dürüst liste)

- **Listede görünmek için aynı genel IP gerekir.** Aynı Wi-Fi'daki cihazlar normalde görünür; bir cihaz IPv6, diğeri IPv4 kullanıyorsa ya da ağ cihazları yalıtıyorsa görünmez, o zaman "Kodla bağlan" kullanılır. Operatörlerin ortak IP'si (CGNAT) yüzünden mobil veride yabancı cihazlar da listede çıkabilir; bağlantı yine de ancak karşı taraf "Kabul et"erse kurulur.
- **Doğrudan bağlantı için ağlar uygun olmalı.** Varsayılan kipte iki cihaz aynı Wi-Fi'da (ya da telefonun hotspot'unda) olmalı. Misafir Wi-Fi'ları cihazları birbirinden yalıtabilir. Farklı ağlar için STUN seçeneği çoğu evde çalışır; bazı kurumsal/operatör ağlarında (simetrik NAT) çalışmaz, çünkü aktarma (TURN) sunucusu bilerek yok.
- **Kamerayla QR okuma tarayıcıya bağlıdır.** Tarayıcının yerleşik `BarcodeDetector`'ı varsa kullanılır (Android Chrome, macOS Chrome gibi). Windows/Linux'taki Chrome ve Firefox'ta yoktur; orada iki yol var:
  - Kodu kopyala-yapıştır yap (telefondan kendine mesaj/e-posta ile gönderip bilgisayarda yapıştırmak), ya da
  - [jsQR](https://github.com/cozmo/jsQR)'ın `dist/jsQR.js` dosyasını `vendor/jsQR.js` olarak koy; uygulama onu otomatik bulur (Apache-2.0, depoya eklenmedi).

  Telefonun kendi kamera uygulaması her yerde çalışır; ilk QR'ı okutmak için uygulama içi tarayıcıya gerek yoktur.
- Kamera ve PWA kurulumu için sayfanın **HTTPS** (ya da `localhost`) üzerinden açılması gerekir.
- Alınan dosya belleğe toplanıp indirilir; birkaç GB'lık dosyalarda cihazın belleği yetmeyebilir. Kaydetmeden sekme kapanırsa dosya kaybolur.
- Aktarım sırasında ekranın uyumaması için ekran kilidi istenir; yine de aktarım bitene kadar uygulamayı ön planda tut.

## Yayınlamak

İki parça var: uygulama (statik dosyalar, GitHub Pages) ve eşleştirme sunucusu (`worker/`, Cloudflare).

### 1) Uygulama: GitHub Pages

Statik dosyalardan ibarettir, derleme adımı yoktur.

1. Bu klasörü bir GitHub deposuna it.
2. Ayarlar → Pages → "Deploy from a branch" → `main` / `(root)`.
3. Adres `https://<kullanıcı>.github.io/<depo>/` olur. İki cihazda da bu adresi aç ve "Ana ekrana ekle".

Netlify, Cloudflare Pages gibi her statik barındırma da olur. Yayında bir değişiklik yaparsan `sw.js` içindeki `VERSION` değerini artır.

### 2) Eşleştirme sunucusu: Cloudflare Worker

`worker/` klasörü bir Worker ve bir Durable Object içerir. Cloudflare panelindeki kod düzenleyiciye yapıştırarak **yayınlanamaz** (Durable Object tanımı gerekir); şu iki yoldan biriyle yayınlanır. Ücretsiz plan yeter.

**A. GitHub'a bağlayarak (her `git push` kendiliğinden yayınlar):**
Cloudflare paneli → Workers & Pages → Worker'ın (`hadigit`) → Settings → Builds → **Connect** → bu GitHub deposunu seç → *Root directory* olarak `worker` yaz → kaydet. Deploy komutu `npx wrangler deploy` olarak kalsın.

**B. Bilgisayardan:**
```sh
cd worker
npm install
npx wrangler login
npx wrangler deploy
```

Sonra `https://<worker-adın>.<hesabın>.workers.dev/saglik` adresini aç; "çalışıyor" yazmalı. Adres `discover.js` içindeki `SERVER` ile aynı olmalı (başında `wss://`, sonunda `/ws`). Worker'ın adı `worker/wrangler.jsonc` içindeki `name` ile aynı olmalı.

Yalnızca kendi sayfandan bağlanılsın istersen `worker/src/index.js` içindeki `ALLOWED_ORIGINS` listesine sayfa adresini yaz (örn. `https://kullanici.github.io`).

## Geliştirme

```sh
python3 -m http.server 8000      # sonra http://localhost:8000
npm i -D playwright && npx playwright install chromium
node test/e2e.mjs                # QR yedek yolu: iki sayfayı eşleştirip dosya aktarır
node test/e2e-yakin.mjs          # yakındaki cihazlar: gerçek Room koduyla bul, kabul et, bağlan, dosya aktar
cd worker && node test.mjs       # eşleştirme sunucusunun mantığı (ağ gerekmez)
MDNS=1 node test/e2e.mjs         # Chrome'un varsayılan yerel adres gizlemesiyle
```

Test şunları doğrular: kod üretimi, QR'ın (OpenCV varsa) geri okunabilmesi, eşleşme, 5 MB'lık rastgele dosyanın SHA-256 ile birebir gelmesi, boş dosya, Türkçe dosya adı, metin gönderme, kopmanın bildirilmesi, adresle otomatik katılım ve yasal/kılavuz sayfalarının iletişim bilgisiyle birlikte yayında olması.

### Dosyalar

| Dosya | Görevi |
|---|---|
| `index.html`, `app.js`, `style.css` | Arayüz |
| `discover.js` | Yakındaki cihazları bulma ve eşleşme bilgisini eşleştirme sunucusu üzerinden iletme |
| `worker/` | Cloudflare Worker (eşleştirme sunucusu): `src/index.js`, `wrangler.jsonc`, `test.mjs` |
| `signal.js` | WebRTC oturum bilgisini kısa koda çevirir/geri açar (`o.…` teklif, `a.…` cevap) |
| `peer.js` | Bağlantı, dosya parçalama, geri basınç, alma |
| `qr.js`, `scan.js` | QR üretme ve kamerayla okuma |
| `nasil-kullanilir.html`, `gizlilik.html`, `kosullar.html` | Kılavuz ve yasal metinler |
| `sw.js`, `manifest.webmanifest`, `icons/` | Çevrimdışı çalışma, ana ekrana ekleme, logo |
| `vendor/qrcode-generator.js` | QR üretici (aşağıya bak) |

## Lisans

[MIT](LICENSE) © Özgüler Forge. Üçüncü taraf bileşen: `vendor/qrcode-generator.js`, Kazuhiko Arase'nin *QRCode for JavaScript* kütüphanesinin (MIT) tek modülde birleştirilmiş halidir; telif notu dosyanın başında durur. "QR Code", DENSO WAVE INCORPORATED'ın tescilli markasıdır. "hadiGET" adı ve logosu Özgüler Forge'a aittir; değiştirilmiş sürümleri aslıymış gibi sunmayın.
