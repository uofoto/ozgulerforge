# PosterForge Studio Pro — PWA 2.3.6

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
- İlk yayın: 21.11.2026
- Son güncelleme: 23.11.2026
- Güncel sürüm: 2.3.6
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


## PosterForge Studio Pro 2.3.3 — Aydınlık tema
- Kasvetli siyah arayüz, ferah açık renkli çalışma alanına dönüştürüldü.
- Kırık beyaz yüzeyler, yumuşak mavi/lila vurgular ve mint tonları kullanıldı.
- Paneller, alt bilgi, ayarlar, önizleme kartları ve iletişim pencereleri açık temaya uyarlandı.
- Kontrast, form alanları ve klavye odak durumları iyileştirildi.
- PWA servis çalışanı önbellek sürümü yükseltildi.


## Sürüm 2.3.4 — Uygulama içi montaj kılavuzu
- Montaj kılavuzu artık ayrı PDF açmak yerine uygulama içinde kart tabanlı bir pencerede görüntülenir.
- Sayfa planı, A1/B1 benzeri sayfa etiketleri ve poster/baskı özeti dinamik olarak gösterilir.
- PDF çıktısı, kılavuz ekranındaki isteğe bağlı indirme düğmesine taşındı.
- Service worker önbelleği 2.3.4 sürümüne yükseltildi.


## Sürüm 2.3.5 — Okunabilir açık tema
- Açık temadaki soluk metinlerin kontrastı artırıldı.
- Form alanları, açıklamalar, küçük etiketler ve kart yüzeyleri daha net hâle getirildi.
- Üst araç çubuğundaki ölçü kapsülü açık temayla uyumlu olacak şekilde düzenlendi.
- Önceki uygulama içi montaj kılavuzu korunmuştur.


## Sürüm 2.3.6 — Kontrast düzeltmesi
- Duvar Boyutu Özeti kartı açık ve yüksek kontrastlı yüzeye dönüştürüldü.
- Kart başlığı, ölçü ve yaprak sayısı metinleri netleştirildi.
- Canlı Önizleme / Orijinali Göster alt araç çubuğu açık yüzeye alındı.
