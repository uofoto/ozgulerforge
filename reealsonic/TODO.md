# ReelSonic — Teslim Maddeleri

- [x] **Herkese açık Reel bağlantısı girişi ve doğrulama**
  - Uygulama Türkçe arayüzde herkese açık Instagram Reel bağlantısı kabul eder.
  - Desteklenen `instagram.com/reel/...` ve `instagram.com/reels/...` biçimleri istemci tarafında doğrulanır.
  - Geçersiz, özel, oturum gerektiren veya desteklenmeyen kaynaklar için açıklayıcı hata mesajı gösterilir.

- [x] **Yetkili kullanım onayı ve bilgilendirme**
  - Dışa aktarma öncesinde kullanıcı, içerik üzerinde gerekli kullanım/indirme hakkına sahip olduğunu açıkça onaylar.
  - Telif, gizlilik ve Instagram ile resmi bağlantı bulunmadığına ilişkin görünür bilgilendirme sunulur.

- [x] **İzinli sağlayıcıya ayrıştırılmış dışa aktarma akışı**
  - UI akışı, `VITE_AUDIO_PROVIDER_URL` ile bağlanabilen izinli bir sağlayıcı adaptörü kullanır.
  - Sağlayıcı bağlı değilse demo akışı, gerçek medya varmış gibi davranmadan kullanıcıya durumu açıklar.
  - Hazırlanıyor, işleniyor, tamamlandı ve hata durumları ilerleme ekranında gösterilir.

- [x] **Ses dosyasını indirme ve işlem geçmişi**
  - Sağlayıcı çıktısı hazır olduğunda ses/müzik dosyasını indirme seçeneği sunulur.
  - Son işlemler cihazda URL, durum ve zaman bilgileriyle saklanır; yeniden görüntülenebilir ve temizlenebilir.

- [x] **Kurulabilir ve çevrimdışı açılabilir PWA**
  - Uygulama manifesti, uygulama ikonları, servis çalışanı ve çevrimdışı uygulama kabuğu eklenir.
  - Ana ekrana kurulum çağrısı uygun tarayıcılarda gösterilir.

- [x] **Erişilebilir, mobil öncelikli Türkçe deneyim**
  - Klavye odağı, etiketler, canlı durum alanları ve duyarlı yerleşim uygulanır.
  - Sade, modern, karanlık ve sıcak vurgu renkli ReelSonic görsel dili kullanılır.
