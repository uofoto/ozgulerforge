// Groq OpenAI-uyumlu Chat Completions sağlayıcısı.
import { DATA_URL } from '../media.js';

export const groq = {
  id: 'groq',
  buildMessages(hist, model) {
    const messages = [];
    for (const h of hist) {
      const parts = [];
      if (h.msgText) parts.push({ type: 'text', text: h.msgText });
      if (model.vision) (h.images || []).forEach(img => {
        const match = img.dataUrl && img.dataUrl.match(DATA_URL);
        if (match) parts.push({ type: 'image_url', image_url: { url: img.dataUrl } });
      });
      if (parts.length) messages.push({ role: h.role === 'assistant' ? 'assistant' : 'user', content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts });
    }
    return messages;
  },
  buildBody({ model, hist, systemText }) {
    return JSON.stringify({ model: model.model, stream: true, temperature: model.temperature, messages: [{ role: 'system', content: systemText }, ...this.buildMessages(hist, model)] });
  },
  endpoint() { return 'https://api.groq.com/openai/v1/chat/completions'; },
  checkAuth(creds) { if (!creds.groqKey) throw Object.assign(new Error('Groq API anahtarı eksik.'), { kind: 'auth' }); },
  headers(creds) { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + creds.groqKey }; },
  handleEvent(parsed, acc, emit) {
    const ch = parsed.choices && parsed.choices[0];
    if (!ch) return;
    if (ch.finish_reason === 'length') acc.finishReason = 'MAX_TOKENS';
    const delta = ch.delta || {};
    if (Array.isArray(delta.annotations)) delta.annotations.forEach(a => {
      const u = a && (a.url_citation || a);
      if (u && /^https?:\/\//.test(u.url || '') && !acc.sources.some(x => x.uri === u.url)) acc.sources.push({ uri: u.url, title: u.title || u.url });
    });
    if (typeof delta.content === 'string' && delta.content) emit(delta.content);
  }
};
