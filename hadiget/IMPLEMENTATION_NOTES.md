# hadiGET 1.3.0 – güvenli, geriye dönük uyumlu iyileştirme

## Bu pakette yapılan değişiklik

- Mevcut WebRTC veri kanalı ve 16 KB aktarım parçalama yapısı korundu.
- Gönderen dosyayı 4 MB bloklara ayırarak her blok için SHA-256 özeti hesaplıyor.
- Özetler aktarım başlangıç bilgisinde alıcıya iletiliyor.
- Alıcı, gelen veriyi 4 MB bloklar halinde doğruluyor; doğrulama başarısızsa dosyayı kaydetmiyor ve aktarımı hata ile sonlandırıyor.
- Büyük dosyanın tamamı doğrulama için belleğe alınmıyor; en fazla bir doğrulama bloğu kullanılıyor.
- Eski sürüm istemcilerden gelen ve doğrulama alanı içermeyen aktarım bilgileri geriye dönük uyumluluk için kabul ediliyor.
- Önbellek sürümü 1.3.0'a yükseltildi.

## Mevcut kaynakta zaten bulunanlar

- 16 KB WebRTC veri parçaları ve geri basınç kontrolü.
- QR ile sunucusuz teklif/cevap eşleştirmesi. Aynı yerel ağ/hotspot üzerinde, cihazlar birbirine erişebiliyorsa internet olmadan kullanılabilir.
- QR kamera tarama desteği, tarayıcının BarcodeDetector API'sine bağlı.
- Büyük dosyaların alınmasında OPFS kullanımı (destekleyen tarayıcılarda).

## Henüz bu sürümde eklenmeyenler

- Kesilen aktarımı yeniden bağlantıdan sonra kaldığı byte konumundan sürdürme. Bunun için kalıcı transfer kimliği, OPFS parça günlüğü, yeniden bağlanma protokolü ve kullanıcıya devam/yeniden başlat seçimi gerekir.
- Aynı anda birden fazla aktif cihaz oturumu. Mevcut `app.js` ve `peer.js` uygulama akışı tek aktif `peer` değişkenine göre tasarlanmıştır; bunu değiştirmek çoklu oturum yöneticisi ve oturum bazlı aktarım listesi gerektirir.
- İnternetsiz otomatik yerel cihaz keşfi. Tarayıcı tabanlı PWA, işletim sistemi seviyesindeki mDNS/Bonjour/UDP yayınlarını doğrudan kullanamaz. Bu özellik için yerel ağda çalışan ek bir keşif servisi veya yerel/native yardımcı gerekir. QR ile sunucusuz bağlantı mevcut yedek yöntem olarak korunmuştur.

## Kontrol

- `node --check peer.js`, `node --check app.js`, `node --check i18n.js`: başarılı.
- `node worker/test.mjs`: başarılı.
- Playwright uçtan uca testleri bu çalışma ortamında çalıştırılamadı; `playwright` bağımlılığı kurulu değildi. Yayın öncesi `npm install` ve `npm test` çalıştırılmalı.
