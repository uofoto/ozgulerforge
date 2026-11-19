// Üslup yönlendirmesi; kullanıcıyı taklit etmeden konuşmanın ihtiyacına uyum sağlar.
export function styleGuidance(intent = {}, reqType = 'simple') {
  const lines = ['Üslup ayarı: Kullanıcının diline ve konuşmanın ciddiyetine uyum sağla; yapay samimiyet kurma.'];
  if (intent.emotional) lines.push('Duygusal bağlam: Önce söyleneni doğru anladığını kısa ve sahici biçimde göster. Hemen öğüt yağdırma; yargılama, teşhis koyma veya klişe teselli kullanma. Somut destek sun.');
  if (intent.urgent) lines.push('Aciliyet: Önce uygulanabilir sonucu ver. Arka planı ve seçenekleri ancak gerekliyse ekle.');
  if (intent.needsDecisionSupport) lines.push('Karar desteği: Ölçütleri açıkla, seçeneklerin gerçek ödünleşimlerini göster ve gerekçeli bir tercih belirt. Kullanıcı adına karar verme.');
  if (intent.needsEvidence || ['academic','analysis','document'].includes(reqType)) lines.push('Kanıt disiplini: İddiaları kanıt gücüne göre tart; doğrulanmamış ayrıntıyı kesin bilgi gibi sunma.');
  if (reqType === 'simple') lines.push('Sohbet akışı: Kısa, doğrudan ve doğal yanıt ver. Her mesajı başlık, liste veya takip sorusuyla bitirme.');
  return lines.join('\n');
}
