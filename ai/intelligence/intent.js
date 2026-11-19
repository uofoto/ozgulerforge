// İstek sınıflandırmasını anahtar kelime eşleşmesinin ötesinde, görev sinyalleriyle zenginleştirir.
const patterns = {
  urgent: /acil|hemen|ivedi|şimdi lazım|vakit yok/i,
  emotional: /üzgünüm|moralim|kaygı|korkuyorum|endişeliyim|çok yoruldum|zorlanıyorum|içimi dökmek|canım sıkkın/i,
  decision: /karar ver|hangisini seç|tercih et|almalı mıyım|mantıklı mı|değer mi/i,
  explain: /anlat|açıkla|öğret|nasıl yapılır|adım adım/i,
  compare: /karşılaştır|farkı ne|hangisi daha|avantaj.*dezavantaj/i,
  create: /yaz|oluştur|tasarla|hazırla|üret|düzenle/i,
  verify: /doğrula|teyit et|kaynak|güncel|mevzuat|istatistik|kanıt/i
};
export function detectIntent(text = '') {
  const t = String(text || '');
  const signals = Object.entries(patterns).filter(([, re]) => re.test(t)).map(([k]) => k);
  return { signals, emotional: signals.includes('emotional'), urgent: signals.includes('urgent'),
    needsEvidence: signals.includes('verify'), needsDecisionSupport: signals.includes('decision') || signals.includes('compare'),
    primary: ['verify','decision','compare','create','explain','emotional','urgent'].find(x => signals.includes(x)) || 'conversation' };
}
