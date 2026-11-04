# Özgüler Forge · Video İndirici (PWA)

X (Twitter) gönderi bağlantısını yapıştırıp videoyu veya GIF'i cihaza indiren, telefona kurulabilen statik web uygulaması. Sunucu, hesap, reklam ve analitik yok.

## Yayınlamadan önce (önemli)

1. `config.js` içindeki **`contactEmail`** alanına iletişim e-postanı yaz. Yasal sayfalar (KVKK, telif bildirimi) bu adresi kullanır; boşsa sayfada sarı bir uyarı görünür.
2. `legal.html` metinleri genel bir şablondur, hukuki danışmanlık değildir. Yayına almadan önce bir avukata gözden geçirtmeni öneririz.
3. Metinleri değiştirirsen `config.js` içindeki `legalVersion` ve `legalDate` değerlerini güncelle; kullanıcılardan yeniden onay istenir.
4. Yeni sürüm yayınlarken yalnızca `config.js` içindeki `version` değerini artır (önbellek adı ve ekrandaki sürüm buradan gelir).

## Özellikler

- Gönderi bağlantısından video/GIF bulma, kalite seçimi (ör. 720p / 480p), önizleme oynatıcısı
- İlerleme çubuğu ve iptal; iPhone'da paylaşım sayfası ile "Videoyu Kaydet"
- Doğrudan indirme engellenirse (403 vb.) anlaşılır hata + yedek panel: burada önizle, bağlantıyı kopyala, yeni sekmede aç, platforma özel yönerge
- Son aramalar (isteğe bağlı, yalnızca cihazda), tek dokunuşla tekrar açma ve temizleme
- Açık / koyu / otomatik tema, ayarlar penceresi, "tüm yerel verileri sil"
- Panodaki bağlantıyı otomatik yerleştirme (isteğe bağlı)
- Android'de X'in Paylaş menüsünden doğrudan açılma (`share_target`)
- Çevrimdışı açılış, çevrimdışı göstergesi, ana ekrana ekleme düğmesi
- Kullanım koşulları onay şeridi; Kullanım Koşulları, Gizlilik, KVKK Aydınlatma, Çerez/Yerel Depolama ve Telif/İçerik Bildirimi sayfası (`legal.html`)
- Sık sorulanlar bölümü

## Çalıştırma

PWA kurulumu için HTTPS gerekir (`localhost` hariç).

```bash
cd x-video-indir
python3 -m http.server 8080
# http://localhost:8080
```

Yayınlamak için klasörü olduğu gibi Netlify, Cloudflare Pages veya GitHub Pages'e yükle. Alan adı `ozgulerforge.com.tr`: barındırma sağlayıcısında özel alan adı olarak ekleyip DNS kayıtlarını sağlayıcının verdiği değerlere yönlendir (HTTPS sertifikası genelde otomatik gelir). Adres değişirse `index.html` ve `legal.html` içindeki `canonical`/`og:url` ile `config.js` içindeki `siteUrl` değerini güncelle.

## Nasıl çalışır

1. Bağlantıdan gönderi kimliği çıkarılır.
2. Gönderi verisi `api.fxtwitter.com` üzerinden alınır.
3. Yalnızca `*.twimg.com` adresleri kabul edilir; video tarayıcıdan doğrudan indirilir. Site bilgisi (referrer) gönderilmez.
4. İndirme başarısız olursa yedek panel devreye girer.

## Bilinen sınırlar

- Üçüncü taraf `fxtwitter` servisine bağlıdır; servis değişirse `config.js` içindeki `api` güncellenmelidir.
- Gizli hesaplar, silinmiş veya yaş kısıtlı gönderiler çalışmayabilir.
- Bazı ağlar, VPN'ler veya DNS filtreleri `twimg.com` adresini engelleyebilir.

## Dosyalar

| Dosya | Görev |
|---|---|
| `index.html`, `style.css` | Arayüz ve tema |
| `app.js` | Bağlantı çözme, indirme, geçmiş, ayarlar |
| `config.js` | Marka, sürüm, iletişim e-postası, API adresi |
| `legal.html` | Yasal metinler |
| `sw.js` | Çevrimdışı kabuk önbelleği |
| `manifest.webmanifest` | Kurulum ve paylaşım hedefi |
| `icons/` | Uygulama simgeleri |
