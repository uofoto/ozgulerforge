// Motor kataloğu ve "hangi motor için anahtar var" bilgisi. DOM'a dokunmaz.
import { KEYS, PROXY_URL } from '../config.js';
import { storage } from '../storage.js';

// Yalnızca iki motor vardır: "AI Ultra 3.8" ve "AI Lite". Her motorun arkasında tek model durur; başka motor/yedek model yok.
// Model adı Google tarafından kapatılırsa (HTTP 404) yalnızca bu iki satır değiştirilir.
export const ENGINES = [
  { id: 'ultra', label: 'AI Ultra 3.8', desc: 'En güçlü motor: ayrıntılı, derin yanıtlar; fotoğraf ve PDF okur' },
  { id: 'lite', label: 'AI Lite', desc: 'Hızlı motor: günlük sorular için; fotoğraf ve PDF okur' }
];
export const MODELS = [
  { id: 'ultra38', engine: 'ultra', label: 'AI Ultra 3.8', provider: 'gemini', model: 'gemini-3.8-flash', tier: 'strong', vision: true, pdf: true },
  { id: 'lite35', engine: 'lite', label: 'AI Lite', provider: 'gemini', model: 'gemini-3.5-flash-lite', tier: 'light', vision: true, pdf: true }
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
  return Boolean(PROXY_URL || (creds.apiKey && creds.apiKey.trim().length >= 20));   // Önek denetimi yok: Google'ın yeni anahtarları "AIza" ile başlamayabilir
}

export function keyOk(creds) {
  return poolFor(curModel()).some(x => hasKeyFor(x, creds));
}

// Aynı kota havuzunu paylaşan motorları aynı anahtara indirger (OpenRouter :free modelleri tek havuz).
export function poolOf(m) { return m.provider === 'openrouter' ? (/:free$/.test(m.model) ? 'or-free' : 'or:' + m.model) : 'gemini:' + m.model; }
