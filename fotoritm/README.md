# Foto Ritim v3.6.0 – Özgüler Forge

## v3.6.0: Maksimum kalite dışa aktarma motoru
Fujifilm X-T3 / DJI Mini 3 Pro görüntüleri için baştan yazıldı.

| | Eski (v3.5) | Yeni (v3.6) |
|---|---|---|
| Kayıt yöntemi | Gerçek zamanlı ekran kaydı (kare düşebilir) | **Kare kare** render, hiçbir kare düşmez |
| Video kodlayıcı | Tarayıcının varsayılanı (çoğu zaman Baseline) | **H.264 High**, 4K30'da 100 Mbps, 4K60'ta 120 Mbps |
| Renk | Tarayıcının dönüşümü | **BT.709 limited**, kendi GPU dönüşümümüz (ffmpeg referansına ±1) |
| Çözünürlük | Varsayılan 1080p, telefonda 720p'ye zorlanır | **4K (3840×2160)** varsayılan, telefonda da zorlanmaz |
| Kare hızı | 30 sabit | 24 / 25 / 30 / **60 fps** |
| Fotoğraf çözünürlüğü | 4096 px'e küçültme | 5120 px (masaüstü), yüksek kaliteli yeniden örnekleme |
| Giriş videoları | Gerçek zamanlı oynatma | **Kare doğrulukla** konumlandırma (seek) |
| Ses | Gerçek zamanlı kayıt | Ayrı render, **AAC 256 kbps** (yoksa Opus) |
| Dosya yazma | RAM'de biriktirme | Masaüstünde **doğrudan diske akıtma** (büyük dosyalar sorunsuz) |

- **Saf Kalite (efektsiz)** şablonu: vinyet, gren, LUT, zoom, Ken Burns, flaş, sarsıntı kapalı; 4K / 30 fps.
- Tarayıcı WebCodecs'i desteklemiyorsa (eski Safari/Firefox) otomatik olarak eski kayıt motoruna döner.
- Dışa aktarma sırasında ayarlar kilitlenir; **sekmeyi açık tut** (telefonda ekran kapanmaz).
- Hâlâ sıkıştırılmış H.264'tür: matematiksel olarak kayıpsız değil, ama bu bit hızında kaynak ile görsel olarak ayırt edilemez.

## v3.5.1
Boş/siyah video hatası, çift tık koruması, RGB kayması geçişi, eksik PWA ikonları.

## Yayınlama
Tüm dosyaları aynı klasöre HTTPS ile yükle. `sw.js` sürümü `foto-ritim-v3.6.0`; telefonlar "Yeni sürüm hazır" bildirimiyle alır.
