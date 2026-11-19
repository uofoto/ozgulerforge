// Model kataloğu ve sağlayıcı kimlik bilgisi denetimi. DOM'a dokunmaz.
import { KEYS, PROXY_URL } from '../config.js';
import { storage } from '../storage.js';

// Ultra/Lite yalnızca yanıt profilleridir; kullanıcı sağlayıcı seçmez.
export const ENGINES = [
  { id: 'ultra', label: 'AI Ultra 3.8', desc: 'Daha güçlü ve ayrıntılı yanıt profili' },
  { id: 'lite', label: 'AI Lite', desc: 'Daha hızlı ve kısa yanıt profili' }
];

// Sıralama aynı zamanda sağlayıcılar arası otomatik yedekleme sırasıdır.
// Her sağlayıcı yalnızca desteklediği ek türlerine aday olur.
export const MODELS = [
  // Metin görevlerinde önce Groq'un ücretsiz plandaki üretim modelleri kullanılır;
  // kota/erişim sorunu olursa Gemini, ardından OpenRouter yedek olur.
  { id: 'ultraGroqOSS', engine: 'ultra', label: 'AI Ultra 3.8', provider: 'groq', model: 'openai/gpt-oss-120b', tier: 'strong', vision: false, pdf: false, web: false },
  // Qwen görsel destekli ancak önizleme modelidir; yalnızca görsel gerektiren isteklerde yedek/öncelikli adaydır.
  { id: 'ultraGroqQwen', engine: 'ultra', label: 'AI Ultra 3.8', provider: 'groq', model: 'qwen/qwen3.8-27b', tier: 'strong', vision: true, pdf: false, web: false },
  { id: 'ultra38', engine: 'ultra', label: 'AI Ultra 3.8', provider: 'gemini', model: 'gemini-3.8-flash', thinking: 'medium', tier: 'strong', vision: true, pdf: true, web: true },
  { id: 'ultraGroqOSS20', engine: 'ultra', label: 'AI Ultra 3.8', provider: 'groq', model: 'openai/gpt-oss-20b', tier: 'light', vision: false, pdf: false, web: false },
  { id: 'ultraOR', engine: 'ultra', label: 'AI Ultra 3.8', provider: 'openrouter', model: 'openrouter/free', tier: 'strong', vision: false, pdf: false, web: true },
  { id: 'liteGroq', engine: 'lite', label: 'AI Lite', provider: 'groq', model: 'openai/gpt-oss-20b', tier: 'light', vision: false, pdf: false, web: false },
  { id: 'lite35', engine: 'lite', label: 'AI Lite', provider: 'gemini', model: 'gemini-3.5-flash-lite', thinking: 'low', tier: 'light', vision: true, pdf: true, web: true },
  { id: 'liteOR', engine: 'lite', label: 'AI Lite', provider: 'openrouter', model: 'openrouter/free', tier: 'light', vision: false, pdf: false, web: true }
];

export function curModel() {
  const id = storage.get(KEYS.MODEL);
  return ENGINES.find(e => e.id === id) || ENGINES[0];
}
export function poolFor(engine) { return MODELS.filter(m => m.engine === engine.id); }

// Seçili profilin havuzu tükenirse (kota/anahtar/hata) diğer profilin modelleri son çare olarak eklenir.
export function poolWithSpillover(engine) {
  const own = poolFor(engine);
  const seen = new Set(own.map(m => m.provider + '|' + m.model));
  const extra = MODELS.filter(m => m.engine !== engine.id && !seen.has(m.provider + '|' + m.model));
  return { own, extra };
}

// Ekranda gösterilecek sağlayıcı/model adı.
export const PROVIDER_NAMES = { gemini: 'Gemini', groq: 'Groq', openrouter: 'OpenRouter' };
export function engineName(m) { return (PROVIDER_NAMES[m.provider] || m.provider) + ' · ' + String(m.model).replace(/^.*\//, ''); }

// creds: { apiKey, groqKey, orKey }
export function hasKeyFor(m, creds = {}) {
  if (m.provider === 'openrouter') return Boolean(creds.orKey && creds.orKey.trim());
  if (m.provider === 'groq') return Boolean(creds.groqKey && creds.groqKey.trim());
  return Boolean(PROXY_URL || (creds.apiKey && creds.apiKey.trim().length >= 20));
}
export function keyOk(creds) { return poolFor(curModel()).some(x => hasKeyFor(x, creds)); }

// Ücretsiz OpenRouter yönlendiricisi aynı ortak günlük havuzu paylaşır.
export function poolOf(m) {
  if (m.provider === 'openrouter') return m.model === 'openrouter/free' || /:free$/.test(m.model) ? 'openrouter:free' : 'openrouter:' + m.model;
  return m.provider + ':' + m.model;
}
