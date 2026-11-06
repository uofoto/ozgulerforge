/* Özgüler Forge – tek yapılandırma kaynağı (sayfa ve service worker ortak kullanır) */
self.FORGE_CONFIG = {
  brand: "Özgüler Forge",
  version: "1.1.4",              // her yayında artır; önbellek adı buradan türer
  siteUrl: "https://ozgulerforge.com.tr",
  legalVersion: "2026-11-04",    // yasal metinler değişince güncelle: kullanıcıdan yeniden onay istenir
  legalDate: "4 Kasım 2026",
  contactEmail: "iletisim@ozgulerforge.com.tr",
  siteHost: "www.ozgulerforge.com.tr",
  api: "https://api.fxtwitter.com/status/",
  historyLimit: 20,
};
