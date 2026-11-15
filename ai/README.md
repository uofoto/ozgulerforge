# Forge AI (v6.6 PRO)

**Geliştirici:** Ozguler Forge  
**İletişim:** iletisim@ozgulerforge.com.tr

## v6.6 Düzeltmeleri
1. **Yenilenmiş Modern İkon:** Sol menü başlığında ve `manifest.json` uygulama ikonunda dışa doğru ışın yayan yapay zeka çip/gecikme ikonumuz (SVG) aktif edildi. Tarayıcı önbelleğinden dolayı eski ikonun görünmesi sorunu SVG ikon ve güncel cache tetikleyicisiyle çözüldü.
2. **Otomatik Sürüm Denetimi ve Kurulum:** Uygulama açılışında, sekme odaklandığında ve her 30 dakikada bir arka planda sunucudaki `sw.js` sürümü kontrol edilir. Yeni bir sürüm tespit edildiğinde kullanıcıya hissettirmeden Service Worker güncellenir ve sayfa otomatik olarak en güncel sürümle yenilenir.
