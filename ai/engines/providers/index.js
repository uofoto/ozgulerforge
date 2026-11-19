// Model kaydındaki provider alanına göre sağlayıcıyı seçer.
import { gemini } from './gemini.js';
import { openrouter } from './openrouter.js';
import { groq } from './groq.js';

export const providers = { gemini, openrouter, groq };
export function providerOf(model) { return providers[model.provider] || gemini; }
