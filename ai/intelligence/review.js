// İkinci model çağrısı yapmadan, üretim modeline görevle orantılı öz-denetim yönergesi verir.
export function reviewGuidance(signals = {}) {
  if (signals.highStakes) return 'Yanıt öncesi denetim: Riskli alanlarda sınırlarını açıkça belirt; kişiye özel kesin hüküm veya profesyonel değerlendirme yerine geçecek öneri verme. Kritik varsayımları kontrol et.';
  if (signals.reviewRequired) return 'Yanıt öncesi denetim: Sonucu göndermeden önce olgusal iddiaları, hesapları, kaynakların gerçekten desteklediği noktaları ve kullanıcının talebine uygunluğu kontrol et. Emin olmadığın ayrıntıyı işaretle.';
  return 'Yanıt öncesi denetim: Gereksiz tekrarları ve desteklenmeyen kesin ifadeleri ayıkla; kısa isteğe kısa yanıt ver.';
}
