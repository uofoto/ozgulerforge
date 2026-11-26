# Pratik PWA — Uygulama Planı

## Amaç ve kapsam

Kullanıcının paylaştığı Pratik `index.html` içindeki 20 aracı, masaüstü web sitesi yerine telefonda uygulama gibi kullanılabilen, kurulabilir ve çevrimdışı kabuğa sahip bir PWA deneyimine taşımak. Ürün dili Türkçe olacak; temel güven vaadi dosyaların cihazdan çıkmaması, üyelik gerektirmemesi ve işlemlerin mümkün olduğunca tarayıcıda yapılmasıdır.

## Uygulama yaklaşımı

- Framework bağımlılığı olmayan, hızlı açılan HTML/CSS/JavaScript SPA.
- Hash tabanlı iç gezinme; Ana Sayfa, Araçlar, Geçmiş ve Ayarlar görünümleri.
- 20 aracın tamamı tek bir araç veri modeli üzerinden oluşturulacak; böylece katalog, arama, kategori filtreleri, mobil menü ve çalışma alanları aynı kaynaktan beslenecek.
- Görsel işleme için File API, Canvas, ImageBitmap ve download linkleri kullanılacak.
- Video için yerel video önizleme ve desteklenen tarayıcı API’leriyle kare yakalama; diğer video işlemleri için tarayıcı içi motor durumu ve kullanıcıya açık destek mesajı.
- QR kodu çevrimdışı çalışan MIT lisanslı bir modülle, JPG→PDF çok sayfalı yerel PDF üreticisiyle çalışır. Tam PDF düzenleme ve video codec araçları hazır değilse açıkça devre dışı gösterilir; sahte çıktı sunulmaz.
- `localStorage` ile son araçlar, işlem sayısı ve tema tercihi tutulacak; dosya içerikleri tutulmayacak.

## Proje yapısı

- `index.html`: PWA HTML kabuğu, erişilebilir landmark'lar ve uygulama giriş noktası.
- `styles.css`: mobil öncelikli tasarım sistemi, responsive düzen, kartlar, çalışma alanı ve karanlık tema.
- `app.js`: araç kataloğu, yönlendirme, dosya bırakma/seçme, Canvas tabanlı görsel işlemleri, geçmiş ve PWA kurulum davranışı.
- `manifest.webmanifest`: uygulama adı, renkleri, standalone görüntüleme ve ikon referansları.
- `sw.js`: uygulama kabuğu için cache-first service worker ve gezinme fallback'i.
- `icon.svg`: logo/uygulama ikonu.
- `manus-routes.json`: `/` tek SPA rotasının beyanı.
- `TODO.md`: kabul ölçütleri ve teslim durumu.

## Tasarım yönü

### Alternatifler

1. Sessiz teknoloji atölyesi — **%7**: krem zemin, mürekkep metin ve turkuaz vurgu ile güven veren kişisel üretkenlik stüdyosu.
2. Neon dosya laboratuvarı — **%6**: yüksek kontrastlı koyu arka plan, parlak mor ve asit yeşili etiketler.
3. Belge arşivi — **%5**: kâğıt dokusu, mühür kırmızısı ve klasik serif hiyerarşisi.

### Seçilen yön: Sessiz teknoloji atölyesi

- **Design Movement:** Modern utility editorial; içerik yoğunluğunu sakin boşluk, güçlü tipografi ve küçük renk sinyalleriyle yönetir.
- **Core Principles:** mahremiyet önce; tek elle kullanım; hızlı taranabilirlik; sonuç odaklı geri bildirim.
- **Color Philosophy:** sıcak kırık beyaz güven ve açıklık, grafit metin ciddiyet, sahiplenilebilir turkuaz ise cihaz içinde kalan işlemlerin canlı güven sinyali; amber yalnızca dikkat/öneri için.
- **Layout Paradigm:** üstte sabit uygulama başlığı, içerikte asimetrik hero + yatay hızlı aksiyon şeridi, kategorilerde raf düzeni ve altta başparmak erişimli dock.
- **Signature Elements:** numaralı araç rozetleri; dosya gizliliğini gösteren canlı güven bandı; çalışma alanında sol kenar renk çizgisi.
- **Interaction Philosophy:** hiçbir işlem sessizce başlamaz; seçilen araç, dosya ve beklenen çıktı her zaman görünür. Sonuçlar toast ve geçmiş kaydıyla onaylanır.
- **Animation:** 180–260 ms ease-out; kartlar hafifçe yukarı çıkar, çalışma alanı yandan açılır, yükleme shimmer yerine net durum çubuğu kullanılır. Hareket azaltma tercihi desteklenir.
- **Typography System:** sistem sans-serif; 11–12 px küçük etiketler, 15–17 px kart başlıkları, 34–48 px kısa hero başlıkları; bold yalnızca aksiyon ve araç adlarında.
- **Brand Essence:** Dosya işlerini güvenle cihazında halleden kişisel üretkenlik atölyesi. Kişilik: sakin, becerikli, şeffaf.
- **Brand Voice:** kısa, sakin, doğrudan. Örnek: “Dosyan burada kalır.” / “Çıktın hazır; şimdi indirebilirsin.”
- **Wordmark & Logo:** yuvarlatılmış kare içinde iki katmanlı “P” izini taşıyan turkuaz mühür; wordmark’ta `Piksel` normal, `ce` vurgulu.
- **Signature Brand Color:** `#36c8b0` turkuaz.

## Teslim ve çalıştırma

Uygulama kökten `python3 -m http.server 3000` ile sunulacak. Build gerektirmeyen statik çıktı kullanılacak; `manus-routes.json` ile SPA rotası beyan edilecek. PWA manifesti uygulama tarafından sahiplenilecek ve service worker uygulama kabuğunu cache’leyecek. Kod değişiklikleri doğrulandıktan sonra kanonik Manus Git deposuna checkpoint olarak kaydedilecek.
