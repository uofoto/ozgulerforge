// Model kaydındaki "provider" alanına göre sağlayıcıyı seçer. Yeni sağlayıcı = yeni dosya + buraya bir satır.
import { gemini } from './gemini.js';
import { openrouter } from './openrouter.js';

export const providers = { gemini, openrouter };
export function providerOf(model) { return model.provider === 'openrouter' ? openrouter : gemini; }
