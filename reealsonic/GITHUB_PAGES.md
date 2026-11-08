# GitHub Pages hızlı kurulum

1. Repository'yi GitHub'a push edin.
2. GitHub'da **Settings → Pages → Build and deployment → Source: GitHub Actions** seçin.
3. `main` branch'ine push yaptığınızda `Deploy ReelSonic to GitHub Pages` workflow'u çalışır.
4. Workflow tamamlanınca Actions içindeki `github-pages` environment URL'sini telefonda HTTPS olarak açın.
5. Tarayıcı menüsünden **Ana ekrana ekle** veya **Uygulamayı yükle** seçeneğini seçin.

Kök dizinde elle `index.html` üretmek yerine workflow, React uygulamasını derleyip yayınlanabilir `dist/public/index.html` dosyasını oluşturur. GitHub Pages'a kaynak klasörü değil, workflow'un oluşturduğu artifact yayınlanır.
