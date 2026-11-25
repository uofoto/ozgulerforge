# Değişiklikler

## 0.4.1 (sürüm 36)
- Bağlantı alanları: alana dokununca eski bağlantı tümüyle seçilir (yapıştırmak eskisini değiştirir); X bağlantısı yapıştırılınca eski sonuçlar kalkar; × düğmesi bağlantıyı, durumu ve sonuçları siler; sesi arşive ekledikten sonra X alanı kendiliğinden boşalır.
- Ayarlar → Bulut: “⬇ Bulut yedeğini indir” buluttaki favori/dinleme yedeğini JSON dosyası olarak indirir.
- Yasal metinler tamamlandı (Gizlilik & Koşullar): Kullanım Koşulları, Gizlilik Politikası, KVKK Aydınlatma Metni, Sorumluluk Reddi ve Telif Bildirimi. Google girişi artık yurt dışı aktarım için açık rıza kutusu işaretlenmeden yüklenmez; ses ekleme onayına sorumluluk beyanı eklendi.
- Düzeltme: listeden bir sese basınca ses artık her zaman baştan başlar (eski “kaldığı yerden devam” kaydı yüzünden yarıdan başlıyordu; özellik kaldırıldı, eski kayıtlar temizlenir).
- Alt gezinmede “Arşiv” sekmesi “Sesler” oldu.
- `manus-routes.json` artık isteğe bağlı: yoksa build yine çalışır.

## 0.4.0 (sürüm 35)
**Yeni**
- Klasörler: Şiir, Müzik, Hayata dair. Ses eklerken “Klasör” seçilir (dosya, bağlantı ve X videosu sesi için geçerli); mevcut sesler satırdaki ⋯ → “Klasöre taşı” ile etiketlenir. Arşivde klasör çubuğu ve sayaçlar var; seçili klasöre yeniden dokunmak “Tümü”ne döner. Kesilen kayıt (kesit) orijinalin klasörünü miras alır.
- ZIP yedekte klasörlü sesler `sesler/siir/`, `sesler/muzik/`, `sesler/hayata-dair/` altında durur; `sescebi.json` içinde `category` alanı vardır ve yedekten yüklemede korunur. Klasörsüz sesler eskisi gibi `sesler/` altındadır; eski yedekler sorunsuz yüklenir.
- Tümünü dinle: arşivde görünen liste sırayla çalınır. Çalma düzeni “Tek seferlik / Bunu tekrarla” iken bile bu oturumda sıra ilerler (kayıtlı düzen değişmez). Klasör açıkken bir kayda dokunmak sırayı o klasör yapar; önceki/sonraki düğmeleri ve kilit ekranı kontrolleri klasör içinde kalır. Oynatıcı alt başlığında “Müzik 2/5” gibi konum görünür. “Tümü” görünümünde eski davranış (tüm arşiv sırası) aynen sürer.
- Bağlantı ve X gönderi bağlantısı alanlarında × düğmesi: eski bağlantıyı, durum mesajını ve bulunan videoları tek dokunuşla siler.

**Değişmeyenler**
- Veritabanı şeması, çalma düzeni, tema, yedek/geri yükleme, bulut eşitleme ve istatistik davranışı aynıdır; yeni alan (`category`) yalnızca etiketlenen kayıtlarda bulunur.

## 0.3.0 (sürüm 34)
**Düzeltmeler**
- Service Worker kaydı `sw.js?v=26` idi, önbellek v33'tü. Artık sürüm `sw.js` ve `main.js` içinde tek değerdir; `npm run check` uyuşmazlığı yakalar.
- `?v=` ekleri kaldırıldı; sayfa/betik/stil dosyaları önce ağdan alınır.
- Service Worker kurulumunda çekirdek dosyalar eksikse kurulum artık sessizce geçmez, hata verir ve yeniden denenir.
- Google Fonts kaldırıldı (çevrimdışı çalışma ve gizlilik); sistem yazı tipi kullanılıyor.
- `cloud_sync_js.js` (kullanılmayan, farklı Google Client ID'li kopya) silindi.
- Kullanılmayan ve e-postayı `innerHTML` ile yazan bulut şeridi/kenar çubuğu kodu `cloud-sync.js` içinden kaldırıldı.
- `window.alert` ile gösterilen tanılama, ayarlar sayfasında satır içi çıktıya taşındı.
- Dinleme istatistiği zamanlayıcısı yalnızca çalarken işler.
- İndirme bağlantıları 4 sn yerine 60 sn sonra iptal ediliyor (büyük dosyalarda kesilmesin diye).
- `npm run check` artık tüm JS dosyalarını, sürüm eşitliğini ve arayüz id'lerini denetliyor; `build` önce check çalıştırıyor ve eksik dosyada durur.

**Arayüz (sade ve minimal)**
- 8 CSS dosyası yerine tek `app.css`; tek vurgu rengi, sistem temasını izleyen açık/koyu tema.
- Alt gezinme: Arşiv · Ekle · Stüdyo (masaüstünde sol ray). Ayarlar ve yedek sağ üstte.
- Aynı işi yapan tekrarlı düğmeler kaldırıldı (4 "ekle" yolu → 1, 2 "ara" → 1).
- Liste satırı: oynat · ad · süre/boyut · favori · ⋯ menüsü. Öne çıkan büyük kart ve çift hap düğme yok.
- Oynatıcı tek satır kontrol; ek seçenekler "Seçenekler" altında.
- Unicode simgeler yerine tutarlı SVG simgeler.

**Temizlik**
- Silinen: kullanılmayan CSS sürümleri, `download.zip`, `download`, `public/` kopyası, `vite.config.js`, `tsconfig.json`, `app.config.ts`, eski TODO/ARCHITECTURE dosyaları.
