# Foto Ritim v3.5.1 – Özgüler Forge

## v3.5.1 düzeltmeleri
1. **Boş / siyah video hatası (ana düzeltme):** Önizleme çalışırken ya da önizlemeden hemen sonra "MP4 kaydet"e basıldığında, eski ses kaynağının `onended` olayı yeni kaydı anında bitiriyordu. Sonuç: yalnızca 2 siyah kare + 1 sn ses. Eski kaynağın olayı artık durdurulurken temizleniyor ve her çalıştırma kendi kaynağına bağlı.
2. **Oynatma sırasında ← / → ile atlama** artık oynatmayı kesmiyor (aynı hatanın etkisiydi).
3. **Arka plan / sekme değişimi:** requestAnimationFrame durursa zamanlayıcı devralıyor, kareler üretilmeye devam ediyor.
4. **Boş kayıt koruması:** Kayıt erken bitmişse artık "başarılı" denmiyor, net bir hata gösteriliyor.
5. **Çift tıklama koruması:** Kayıt düğmesine iki kez basmak ikinci bir kayıt başlatmıyor.
6. **RGB Kayması (Glitch) geçişi:** İkinci renk kanalı birinciyi siyaha boğuyordu; kanallar artık ayrı katmanda üretilip toplanıyor (gerçek kromatik sapma).
7. **Eksik PWA ikonları** pakete eklendi (192, 512, maskable, apple-touch).

## Yayınlama
Tüm dosyaları aynı klasöre HTTPS ile yükle. sw.js sürümü `foto-ritim-v3.5.1` olarak artırıldı; telefonlar yeni sürümü "Yeni sürüm hazır" bildirimiyle alır.
