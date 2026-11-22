# 0.2.0 doğrulama / sonraki işler

- [x] Arşivde arama, favoriler, sıralama
- [x] Oynatma hızı, karıştırma ve uyku zamanlayıcısı
- [x] Dalga formunda yakınlaştırma ve pointer sürükleme
- [x] WAV kesitine fade-in / fade-out ve bas/tiz filtreleri
- [x] Açık/koyu tema
- [x] Service Worker cache sürümü eşitleme
- [x] Tek etkin giriş dosyası ve bağımlılıksız statik üretim paketi
- [x] Sözdizimi ve statik üretim kontrolleri
- [ ] Android Chrome ve iOS Safari üzerinde gerçek cihaz testi
- [ ] MP3 kodlama gerekiyorsa lisans/performans değerlendirmeli encoder ekleme
- [ ] Klasör/kategori ve toplu işlem gereksinimini kullanım geri bildirimiyle değerlendirme
- [ ] İşletmeci bilgileriyle KVKK metnini hukuk kontrolünden geçirme

## v24 (entegrasyon)
- Servis çalışanı alt klasörde (/sescebi/) doğru çalışır; sabit "/" yolları kaldırıldı.
- Android'de Paylaş menüsünden dosya alma (share_target) ve SKIP_WAITING mesajı.
- Videodan çözülen ses WAV yerine MP3 (lame.min.js); yüklenemezse WAV.
- Sürükle-bırak, kaldığı yerden devam, depolama dolu uyarısı, iOS ana ekran simgesi/meta.
