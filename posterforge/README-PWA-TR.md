# PosterForge Studio Pro — PWA 2.3.0

## Kurulum
1. Bu klasörün içeriğinin tamamını GitHub Pages kök dizinine yükleyin.
2. `index.html`, `manifest.webmanifest`, `sw.js` ve `icons/` klasörü aynı kökte olmalı.
3. GitHub Pages HTTPS üzerinden yayımlanmalıdır.
4. Siteyi telefonda açın. Tarayıcı menüsünden **Ana ekrana ekle / Uygulamayı yükle** seçeneğini kullanın. Destekleyen tarayıcılarda üstteki **Yükle** düğmesi görünür.

## PWA kapsamı
- Uygulama kabuğu ve ikonlar önbelleğe alınır.
- İlk açılış için internet gerekir.
- Harici CDN kitaplıkları ilk çevrimiçi açılışta önbelleğe alınmaya çalışılır. İlk ziyarette internet yoksa veya sağlayıcı kaynakları engellerse bazı özellikler çevrimdışı çalışmayabilir.
- Güncelleme algılandığında uygulama yenileme bildirimi gösterir.

## Yayın öncesi yasal kontrol — zorunlu
`index.html` içindeki Yasal Bilgiler ekranında bulunan:
- `[Yayıncı adı veya işletme unvanı eklenmelidir]`
- `[Geçerli e-posta ve tebligat adresi eklenmelidir]`

alanlarını gerçek bilgilerle değiştirin. KVKK aydınlatma yükümlülükleri, veri sorumlusu bilgileri, üçüncü taraf CDN/Google Fonts veri akışları ve olası yurt dışına aktarım konuları gerçek dağıtım yapılandırmasına göre hukuk uzmanı tarafından kontrol edilmelidir. Hazır metin, hukuki danışmanlık veya mevzuata tam uyum garantisi değildir.

## Sürüm
- 2.1.0 — 21.11.2026
- Mobil düzen, PWA manifesti, servis çalışanı, yükleme/güncelleme akışı ve uygulama içi yasal bilgilendirme.


## PosterForge Studio Pro 2.3.0 — Geliştirmeler
- Görsel yerleşimi: kırp/doldur, tam görseli koru ve esnet seçenekleri.
- Doldur modunda önizleme tuvali üzerinde sürükleyerek kırpma konumu ayarı.
- Sayfa sayfa küçük önizlemeler ve A1, A2… / A2, B2… montaj etiketleri.
- Baskı öncesi boyut, sayfa sayısı, yön ve efektif DPI kontrolü.
- Efektif kaynak DPI analizi ve kalite uyarısı.
- Ayrı montaj kılavuzu PDF çıktısı.
- PDF baskı kontrol onayı ve %100 gerçek boyut uyarısı.


## 2.3.1 — Alt bilgi sayfaları düzeltmesi
- Hakkında, Gizlilik Politikası ve Kullanım Koşulları bağlantıları için bağımsız ve olay yakalama aşamasında çalışan açma/kapama yöneticisi eklendi.
- Yasal bilgi penceresi görünürlük, kaydırma ve ESC ile kapatma davranışları sağlamlaştırıldı.
- Servis çalışanı önbellek sürümü yükseltildi; eski PWA kabuğunun güncel sayfayı gölgelemesi engellendi.
