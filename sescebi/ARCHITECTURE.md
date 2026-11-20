# Proje mimarisi

Çalışan uygulamanın tek giriş noktası kökteki `index.html` ve `main.js` dosyalarıdır. Stil dosyası `styles.css`, PWA manifesti `manifest.webmanifest`, Service Worker ise `sw.js` dosyasıdır. Önceki ZIP'te bulunan `src/main.ts` ve `src/styles.css` etkin girişe bağlı değildi ve farklı bir uygulama kopyası oluşturuyordu; bu sürümde kaynak karmaşasını önlemek için kaldırılmıştır.

`npm run check` ana JavaScript dosyasının sözdizimini denetler. `npm run build` Vite üretim paketini `dist/` içine çıkarır.
