# ReelSonic

ReelSonic, yalnızca kullanma ve indirme hakkınız olan herkese açık Instagram Reels içeriklerinin sesini, izinli bir sağlayıcı üzerinden dışa aktarmaya yardımcı olan mobil öncelikli bir PWA'dır.

## GitHub Pages ile yayınlama

Bu proje kaynak kodundan doğrudan değil, GitHub Actions ile derlenerek yayınlanır. Bu nedenle GitHub Pages ayarlarında **Settings → Pages → Source → GitHub Actions** seçimini yapın. Daha sonra `main` branch'ine push edin. `.github/workflows/deploy-pages.yml` dosyası React/TSX kaynaklarını derler ve GitHub Pages'ın yayınlayacağı `dist/public/index.html` dosyasını otomatik oluşturur.

Workflow tamamlandığında GitHub Actions sayfasındaki `github-pages` environment URL'sini telefonda HTTPS olarak açın. Tarayıcı menüsünden **Ana ekrana ekle / Uygulamayı yükle** seçeneğini kullanabilirsiniz. PWA kurulumu için GitHub Pages URL'sinin HTTPS olması gerekir.

Vite base path'i otomatik ayarlanır. Normal repository için `https://kullanici.github.io/repository-adi/`, kullanıcı sitesi repository'si (`kullanici.github.io`) için ise kök yol kullanılır. Yerel geliştirme için `pnpm dev:static`, kontrol için `pnpm check`, üretim derlemesi için `pnpm build:static` çalıştırılabilir.

## Gerçek ses sağlayıcısı

Önizleme sürümünde sağlayıcı URL'si bağlı değilse uygulama gerçek medya dosyası indirmez; akışı demo olarak açıkça gösterir. Gerçek ve izinli bir servis bağlamak için GitHub Actions repository secrets veya build environment üzerinden `VITE_AUDIO_PROVIDER_URL` tanımlayın. Sağlayıcı `{ "downloadUrl": "https://..." }` veya `{ "url": "https://..." }` döndürmelidir. İndirme adresi HTTPS olmalı ve sağlayıcı host'u ya da `VITE_AUDIO_DOWNLOAD_HOSTS` ile allowlist'e eklenmiş bir host üzerinden gelmelidir.

Özel hesaplar, oturum gerektiren içerikler veya platform korumalarını aşmaya yönelik yöntemler desteklenmez. Instagram ile resmi bağlantı bulunmaz; telif hakkı ve kullanım izni sorumluluğu kullanıcıya aittir.
