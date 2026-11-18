// Motor kataloğu ve "hangi motor için anahtar var" bilgisi. DOM'a dokunmaz.
import { KEYS, PROXY_URL } from '../config.js';
import { storage } from '../storage.js';

// Kullanıcıya yalnızca "Oforge X" adları gösterilir; gerçek model kimlikleri burada tutulur.
export const MODELS = [
  { id: 'auto', label: 'Oforge AI Otomatik', auto: true },
  { id: 'f1', label: 'Oforge 1', provider: 'gemini', model: 'gemini-4-hydrogen', tier: 'strong', vision: true, pdf: true, desc: 'Gemini 4 Hydrogen, fotoğraf ve PDF destekler' },
  { id: 'g25', label: 'Oforge 2.5 Flash', provider: 'gemini', model: 'gemini-2.5-flash', tier: 'strong', vision: true, pdf: true, desc: 'Gemini 2.5 Flash, fotoğraf ve PDF destekler' },
  { id: 'g20', label: 'Oforge 2.0 Flash', provider: 'gemini', model: 'gemini-2.0-flash', tier: 'light', vision: true, pdf: true, desc: 'Gemini 2.0 Flash, hızlı, fotoğraf ve PDF destekler' },
  { id: 'g15', label: 'Oforge 1.5 Flash', provider: 'gemini', model: 'gemini-1.5-flash', tier: 'light', vision: true, pdf: true, noAuto: true, desc: 'Gemini 1.5 Flash, fotoğraf ve PDF destekler' },
  { id: 'f2', label: 'Oforge 2', provider: 'openrouter', model: 'nvidia/nemotron-3-ultra-550b-a55b:free', tier: 'strong', desc: 'Nemotron 3 Ultra, yalnızca metin' },
  { id: 'f3', label: 'Oforge 3', provider: 'openrouter', model: 'nvidia/nemotron-3.5-lightning:free', tier: 'light', desc: 'Nemotron 3.5 Lightning, hızlı, yalnızca metin' },
  { id: 'f4', label: 'Oforge 4', provider: 'openrouter', model: 'google/gemma-4-31b-it:free', tier: 'mid', vision: true, desc: 'Gemma 4 31B, fotoğraf destekler (PDF yok)' },
  { id: 'f5', label: 'Oforge 5 (Kod)', provider: 'openrouter', model: 'cohere/north-mini-code:free', tier: 'code', desc: 'North Mini Code, yalnızca metin' }
];

export function curModel() {
  const id = storage.get(KEYS.MODEL);
  return MODELS.find(m => m.id === id) || MODELS[0];
}

// creds: { apiKey, orKey }
export function hasKeyFor(m, creds) {
  if (m.provider === 'openrouter') return Boolean(creds.orKey);
  return Boolean(PROXY_URL || (creds.apiKey && creds.apiKey.startsWith('AIza')));
}

export function keyOk(creds) {
  const m = curModel();
  return m.auto ? MODELS.some(x => !x.auto && !x.noAuto && hasKeyFor(x, creds)) : hasKeyFor(m, creds);
}

// Aynı kota havuzunu paylaşan motorları aynı anahtara indirger (OpenRouter :free modelleri tek havuz).
export function poolOf(m) { return m.provider === 'openrouter' ? (/:free$/.test(m.model) ? 'or-free' : 'or:' + m.model) : 'gemini:' + m.model; }
