# Forge AI (v6.7 PRO)

**Geliştirici:** Ozguler Forge  
**İletişim:** iletisim@ozgulerforge.com.tr

## v6.7 Düzeltmeleri

### Güvenlik
1. **Önizleme sandbox'ı:** `allow-same-origin` kaldırıldı. Yapay zekâ tarafından üretilen HTML artık `localStorage` (API anahtarı, sohbetler) içine erişemez.
2. **XSS koruması:** Markdown çıktısı `DOMPurify` ile temizlenir. DOMPurify yüklenemezse içerik düz metin olarak gösterilir.
3. **API anahtarı** artık URL'de değil, `x-goog-api-key` header'ında gönderilir.

### İşlev
4. **Belge/fotoğraf hafızası:** PDF, fotoğraf ve belge metinleri IndexedDB'de saklanır; takip sorularında model ekleri görmeye devam eder. Sohbet silinince ekler de silinir. Tek istek ~20 MB'ı aşarsa anlaşılır bir uyarı verilir.
5. **Mesaj butonları:** Önizle / Kopyala / Sesli Dinle artık metinde apostrof (`'`) olsa da bozulmaz (inline `onclick` kaldırıldı, olay delegasyonu kullanıldı). `/ozetle` slash komutundaki sözdizimi hatası giderildi.
6. **Model seçimi** artık kaydediliyor (`getItem` → `setItem`).
7. **Akış:** Render kare başına en fazla bir kez yapılır; boş yanıt / güvenlik engeli / `MAX_TOKENS` durumları kullanıcıya bildirilir. Sohbet silmeden önce onay istenir.

### PWA
8. **Service Worker:** `sw.js` cache'lenmez (önceki sürümde her kontrol yeni bir cache girdisi bırakıyordu); yalnızca 200/opaque yanıtlar cache'lenir; çevrimdışı fallback eklendi.
9. **Güncelleme akışı:** Kullanıcı meşgul değilse güncelleme otomatik uygulanır; yazı yazıyor, cevap akıyor veya ek varsa "Yenile" bildirimi gösterilir. İlk kurulumda gereksiz sayfa yenilemesi yok.
10. **İkonlar:** Gerçek PNG ikonlar (192, 512, maskable, apple-touch-icon). Manifest `id`'sinden sürüm eki kaldırıldı (sürüm değişince uygulama kimliği değişmesin).
11. Bağımlılık sürümleri sabitlendi; `user-scalable=no` kaldırıldı.

## Dağıtım
Tüm dosyaları aynı klasöre yükleyin: `index.html`, `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`. HTTPS gereklidir. Sonraki sürümlerde `sw.js` içindeki `CACHE_NAME` değerini artırın.

## Bilinen sınırlar
- API anahtarı tarayıcıda (localStorage) tutulur: yalnızca kişisel kullanım içindir. Herkese açık dağıtım için bir sunucu tarafı proxy gerekir.
- `index.html` içindeki model adlarını (`gemini-3.8-flash`, `gemini-3.5-flash-lite`) Google'ın güncel model listesiyle doğrulayın.
