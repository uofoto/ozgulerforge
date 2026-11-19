// Hangi motorların, hangi sırayla deneneceğine karar verir. DOM'a dokunmaz.
import { poolWithSpillover, hasKeyFor } from './models.js';
import { isCooled } from './health.js';
import { mkErr } from './errors.js';

export const REQ_LABELS = {
  simple: 'basit soru', code: 'kod', analysis: 'analiz', document: 'belge incelemesi',
  pdf: 'PDF', vision: 'fotoğraf', vision_analysis: 'fotoğraf analizi', academic: 'akademik', philosophy: 'felsefi düşünme',
  writing: 'yazarlık'
};

export function classifyRequest(text, need) {
  const t = String(text || '').toLowerCase();
  if (need.vision) return /analiz|ayrıntılı|detaylı|değerlendir|kompozisyon|estetik|ışık|renk|ton|derinlik|yorumla|karşılaştır/.test(t) ? 'vision_analysis' : 'vision';
  if (need.pdf) return 'pdf';
  if (/akademik|makale|tez\b|makalesi|literatür|kaynakça|kaynak göster|atıf|hakemli|bilimsel|araştırma (ödev|öner|soru)|apa |dergi/.test(t.slice(0, 800))) return 'academic';
  if (/```|(^|[^a-zçğıöşü])(kod|fonksiyon|script|debug|html|css|python|javascript|sql|regex|api)|(^|[^a-zçğıöşü])bug($|[^a-zçğıöşü])|hata ay/.test(t)) return 'code';
  if (t.length > 3000) return 'document';
  if (/felsef|varoluş|ontoloji|epistemoloji|etik|ahlak|özgür irade|özgürlük|bilinç|hakikat|insan doğası|adalet|erdem|anlam arayışı|yaşamın anlamı|sanatın anlamı/.test(t)) return 'philosophy';
  if (/deneme yaz|makale yaz|konuşma metni|öykü yaz|hikâye yaz|şiir yaz|metni yeniden yaz|üslubunu geliştir|daha etkili yaz|editörlük|redakte/.test(t)) return 'writing';
  if (t.length > 500 || /analiz|incele|karşılaştır|değerlendir|strateji|ayrıntılı|detaylı|rapor|neden|nasıl çalış|tartış|sorgula/.test(t)) return 'analysis';
  return 'simple';
}

export function thinkingLevelFor(model, reqType) {
  // Lite hız odaklı kalır. Ultra ise karmaşık muhakeme gerektiren görevlerde daha fazla düşünme bütçesi kullanır.
  if (model.engine === 'lite' || model.tier === 'light') return 'low';
  if (['academic', 'philosophy', 'analysis', 'document', 'code', 'writing', 'pdf', 'vision_analysis'].includes(reqType)) return 'high';
  return 'medium';
}
export function rankModels(list, type) {
  const order = type === 'simple' ? ['light', 'mid', 'strong', 'code'] : type === 'code' ? ['code', 'strong', 'mid', 'light'] : ['strong', 'mid', 'light', 'code'];
  return list.map((m, i) => [m, i]).sort((a, b) => (order.indexOf(a[0].tier || 'mid') - order.indexOf(b[0].tier || 'mid')) || (a[1] - b[1])).map(x => x[0]);
}
export function needText(need) { return [need.vision && 'fotoğraf', need.pdf && 'PDF'].filter(Boolean).join(' ve '); }

// selected: seçili yanıt profili (curModel()). hist: [{ role, msgText, images, pdfs }]. creds: { apiKey, groqKey, orKey }.
// Seçili motorun modelleri arasından anahtarı olan, isteği okuyabilen ve sağlıklı olanları sıralar.
// Döndürür: { candidates, reqType, need }. Uygun motor yoksa mkErr(...) fırlatır.
export function planRequest({ selected, hist, creds, webOn = false }) {
  const sel = selected;
  const lastH = hist[hist.length - 1] || { images: [], pdfs: [], msgText: '' };
  const need = { vision: hist.some(h => h.images && h.images.length > 0), pdf: hist.some(h => h.pdfs && h.pdfs.length > 0) };
  const reqType = classifyRequest(lastH.msgText, need);
  const { own, extra } = poolWithSpillover(sel);
  const keyed = [...own, ...extra].filter(m => hasKeyFor(m, creds));
  if (!keyed.length) throw mkErr('auth', 'Henüz kullanılabilir bir API bağlantısı yok. Motor ayarlarından en az bir sağlayıcı anahtarı ekleyin.');
  const capable = keyed.filter(m => (!need.vision || m.vision) && (!need.pdf || m.pdf) && (!webOn || m.web));
  if (!capable.length) {
    if (need.vision || need.pdf) throw mkErr('unsupported', 'Eklediğiniz fotoğraf veya PDF için bağlı sağlayıcılar arasında uygun model bulunamadı. Gemini API anahtarını ekleyin.');
    if (webOn) throw mkErr('unsupported', 'Web araması için şu anda bağlı sağlayıcılar arasında uygun model bulunamadı. Gemini veya OpenRouter anahtarı ekleyin.');
    throw mkErr('unsupported', 'Bu istek için uygun model bulunamadı.');
  }
  let candidates;
  const live = capable.filter(m => !isCooled(m));
  if (live.length) {
    // Seçili profilin modelleri önce gelir; diğer profilin modelleri yalnızca son çare yedeğidir.
    const ownLive = live.filter(m => m.engine === sel.id), extraLive = live.filter(m => m.engine !== sel.id);
    candidates = [...rankModels(ownLive, reqType), ...rankModels(extraLive, reqType)];
  }
  else {
    const cooled = capable.map(isCooled);
    if (cooled.every(c => c.kind === 'quota' && c.quota)) {
      const first = cooled.reduce((x, y) => (x.until <= y.until ? x : y));
      throw mkErr('quota', sel.label + ' kotası dolu.', { quota: Object.assign({}, first.quota, { model: sel.label }) });
    }
    candidates = [...rankModels(capable.filter(m => m.engine === sel.id), reqType), ...rankModels(capable.filter(m => m.engine !== sel.id), reqType)];
  }
  candidates = candidates.map(m => m.provider === 'gemini' ? { ...m, thinking: thinkingLevelFor(m, reqType) } : m);
  return { candidates, reqType, need };
}
