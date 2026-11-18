// Motor kataloğu ve "hangi motor için anahtar var" bilgisi. DOM'a dokunmaz.
import { KEYS, PROXY_URL } from '../config.js';
import { storage } from '../storage.js';

// Kullanıcıya yalnızca iki motor gösterilir: "AI Ultra 3.8" ve "AI Lite".
// Her motorun arkasında sırayla denenen yedek modeller vardır (kota/hata olursa sıradaki devreye girer); gerçek model kimlikleri burada tutulur.
export const ENGINES = [
  { id: 'ultra', label: 'AI Ultra 3.8', desc: 'En güçlü motor: ayrıntılı, derin yanıtlar; fotoğraf ve PDF okur' },
  { id: 'lite', label: 'AI Lite', desc: 'Hızlı motor: günlük sorular için; fotoğraf ve PDF okur' }
];
const U = 'AI Ultra 3.8', L = 'AI Lite';
export const MODELS = [
  { id: 'f1', engine: 'ultra', label: U, provider: 'gemini', model: 'gemini-4-hydrogen', tier: 'strong', vision: true, pdf: true },
  { id: 'g25', engine: 'ultra', label: U, provider: 'gemini', model: 'gemini-2.5-flash', tier: 'strong', vision: true, pdf: true },
  { id: 'g20', engine: 'lite', label: L, provider: 'gemini', model: 'gemini-2.0-flash', tier: 'light', vision: true, pdf: true }
];

// Seçili motor (ENGINES öğesi). Kayıtlı değer geçersizse (eski sürümlerden kalan "auto", "f1"… dahil) AI Ultra 3.8.
export function curModel() {
  const id = storage.get(KEYS.MODEL);
  return ENGINES.find(e => e.id === id) || ENGINES[0];
}
export function poolFor(engine) { return MODELS.filter(m => m.engine === engine.id); }

// creds: { apiKey, orKey }
export function hasKeyFor(m, creds) {
  if (m.provider === 'openrouter') return Boolean(creds.orKey);
  return Boolean(PROXY_URL || (creds.apiKey && creds.apiKey.startsWith('AIza')));
}

export function keyOk(creds) {
  return poolFor(curModel()).some(x => hasKeyFor(x, creds));
}

// Aynı kota havuzunu paylaşan motorları aynı anahtara indirger (OpenRouter :free modelleri tek havuz).
export function poolOf(m) { return m.provider === 'openrouter' ? (/:free$/.test(m.model) ? 'or-free' : 'or:' + m.model) : 'gemini:' + m.model; }
