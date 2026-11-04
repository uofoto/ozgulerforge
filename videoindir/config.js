/* Özgüler Forge – tek yapılandırma kaynağı (sayfa ve service worker ortak kullanır) */
self.FORGE_CONFIG = {
  brand: "Özgüler Forge",
  version: "1.1.3",              // her yayında artır; önbellek adı buradan türer
  siteUrl: "https://ozgulerforge.com.tr",
  legalVersion: "2026-11-04",    // yasal metinler değişince güncelle: kullanıcıdan yeniden onay istenir
  legalDate: "4 Kasım 2026",
  contactEmail: "",              // ← YAYINLAMADAN ÖNCE iletişim e-postanı yaz (KVKK ve telif bildirimi için gerekli)
  api: "https://api.fxtwitter.com/status/",
  historyLimit: 20,
};
