# Değişiklikler

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
