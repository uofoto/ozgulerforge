// Kalite profili: kalite tercihi varsayılan; medya uyumluluğu ve kota/fallback kuralları router'da korunur.
export const QUALITY_PROFILE = Object.freeze({ name: 'quality', modelOrder: ['strong','mid','light','code'],
  review: 'adaptive', voice: 'adaptive' });
export function qualitySignals(text = '', reqType = 'simple', intent = {}) {
  const t = String(text || '');
  const highStakes = /teşhis|ilaç|doz|tedavi|hukuki|mahkeme|sözleşme|vergi|yatırım|kredi|güvenlik açığı|kişisel veri/i.test(t);
  const complexity = Math.min(1, (t.length / 1800) + (['academic','analysis','document','code','philosophy'].includes(reqType) ? .35 : 0));
  const reviewRequired = highStakes || intent.needsEvidence || complexity > .72;
  return { highStakes, complexity: Math.round(complexity * 100) / 100, reviewRequired,
    reviewMode: reviewRequired ? 'strict' : 'light' };
}
