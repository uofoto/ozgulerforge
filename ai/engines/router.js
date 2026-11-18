// Hangi motorların, hangi sırayla deneneceğine karar verir. DOM'a dokunmaz.
import { poolFor, hasKeyFor } from './models.js';
import { isCooled } from './health.js';
import { mkErr } from './errors.js';

export const REQ_LABELS = { simple: 'basit soru', code: 'kod', analysis: 'analiz', document: 'belge incelemesi', pdf: 'PDF', vision: 'fotoğraf', academic: 'akademik' };

export function classifyRequest(text, need) {
  const t = String(text || '').toLowerCase();
  if (need.vision) return 'vision';
  if (need.pdf) return 'pdf';
  if (/akademik|makale|tez\b|makalesi|literatür|kaynakça|kaynak göster|atıf|hakemli|bilimsel|araştırma (ödev|öner|soru)|apa |dergi/.test(t.slice(0, 800))) return 'academic';
  if (t.length > 3000) return 'document';
  if (/```|(^|[^a-zçğıöşü])(kod|fonksiyon|script|debug|html|css|python|javascript|sql|regex|api)|(^|[^a-zçğıöşü])bug($|[^a-zçğıöşü])|hata ay/.test(t)) return 'code';
  if (t.length > 500 || /analiz|incele|karşılaştır|değerlendir|strateji|ayrıntılı|detaylı|rapor|neden|nasıl çalış/.test(t)) return 'analysis';
  return 'simple';
}
export function rankModels(list, type) {
  const order = type === 'simple' ? ['light', 'mid', 'strong', 'code'] : type === 'code' ? ['code', 'strong', 'mid', 'light'] : ['strong', 'mid', 'light', 'code'];
  return list.map((m, i) => [m, i]).sort((a, b) => (order.indexOf(a[0].tier || 'mid') - order.indexOf(b[0].tier || 'mid')) || (a[1] - b[1])).map(x => x[0]);
}
export function needText(need) { return [need.vision && 'fotoğraf', need.pdf && 'PDF'].filter(Boolean).join(' ve '); }

// selected: seçili motor (curModel()). hist: [{ role, msgText, images, pdfs }]. creds: { apiKey, orKey }.
// Seçili motorun yedek modelleri arasından anahtarı olan, isteği okuyabilen ve sağlıklı olanları sıralar.
// Döndürür: { candidates, reqType, need }. Uygun motor yoksa mkErr(...) fırlatır.
export function planRequest({ selected, hist, creds }) {
  const sel = selected;
  const lastH = hist[hist.length - 1] || { images: [], pdfs: [], msgText: '' };
  const need = { vision: hist.some(h => h.images && h.images.length > 0), pdf: hist.some(h => h.pdfs && h.pdfs.length > 0) };
  const reqType = classifyRequest(lastH.msgText, need);
  const keyed = poolFor(sel).filter(m => hasKeyFor(m, creds));
  if (!keyed.length) throw mkErr('auth', 'API anahtarı yok. Oforge AI Motor Ayarları bölümünden Gemini veya OpenRouter anahtarınızı girin.');
  const capable = keyed.filter(m => (!need.vision || m.vision) && (!need.pdf || m.pdf));
  if (!capable.length) throw mkErr('unsupported', 'Bu sohbette ' + needText(need) + ' var, ancak ' + sel.label + ' bunu okumak için Gemini API anahtarı gerektirir. Ayarlardan Gemini API anahtarı ekleyin.');
  let candidates;
  const live = capable.filter(m => !isCooled(m));
  if (live.length) candidates = rankModels(live, reqType);
  else {
    const cooled = capable.map(isCooled);
    if (cooled.every(c => c.kind === 'quota' && c.quota)) {
      const first = cooled.reduce((x, y) => (x.until <= y.until ? x : y));
      throw mkErr('quota', sel.label + ' kotası dolu.', { quota: Object.assign({}, first.quota, { model: sel.label }) });
    }
    candidates = rankModels(capable, reqType);
  }
  return { candidates, reqType, need };
}
