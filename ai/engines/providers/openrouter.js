// OpenRouter: istek gövdesi, adres, başlıklar ve akış olaylarının çözülmesi. DOM'a dokunmaz.
import { DATA_URL } from '../media.js';

export const openrouter = {
  id: 'openrouter',

  buildMessages(hist, model) {
    const messages = [];
    for (const h of hist) {
      const orParts = [];
      if (h.msgText) orParts.push({ type: 'text', text: h.msgText });
      h.images.forEach(img => {
        const match = img.dataUrl.match(DATA_URL);
        if (match) {
          if (model.vision) orParts.push({ type: 'image_url', image_url: { url: img.dataUrl } });
          else orParts.push({ type: 'text', text: '[Not: Sohbette bir fotoğraf var ancak bu motor görselleri okuyamıyor; fotoğraf gönderilmedi. Gerekirse kullanıcıdan fotoğrafı tekrar göndermesini ya da içeriğini yazmasını iste.]' });
        }
      });
      h.pdfs.forEach(pdf => {
        if (model.pdf) orParts.push({ type: 'file', file: { filename: pdf.name || 'belge.pdf', file_data: 'data:application/pdf;base64,' + pdf.base64Data } });
        else orParts.push({ type: 'text', text: '[Not: Sohbette bir PDF var ancak bu motor PDF okuyamıyor; dosya gönderilmedi.]' });
      });
      if (orParts.length === 0) continue;
      if (h.role === 'assistant') messages.push({ role: 'assistant', content: h.msgText || '' });
      else messages.push({ role: 'user', content: orParts.every(p => p.type === 'text') ? orParts.map(p => p.text).join('\n') : orParts });
    }
    return messages;
  },

  buildBody({ model, hist, systemText, webOn, proxyUrl }) {
    const payload = {
      model: model.model,
      stream: true,
      temperature: model.temperature,
      messages: [{ role: 'system', content: systemText }, ...this.buildMessages(hist, model)],
      plugins: webOn ? [{ id: 'web' }] : undefined
    };
    if (!proxyUrl) return JSON.stringify(payload);
    return JSON.stringify({
      provider: 'openrouter',
      model: model.model,
      body: payload
    });
  },

  endpoint(model, proxyUrl) {
    if (proxyUrl) return proxyUrl.replace(/\/$/, '');
    return 'https://openrouter.ai/api/v1/chat/completions';
  },

  checkAuth(creds, proxyUrl) {
    if (!proxyUrl && !creds.orKey) throw Object.assign(new Error('OpenRouter API anahtarı eksik.'), { kind: 'auth' });
  },

  headers(creds, proxyUrl) {
    if (proxyUrl) return { 'Content-Type': 'application/json' };
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + creds.orKey };
  },

  handleEvent(parsed, acc, emit) {
    const ch = parsed.choices && parsed.choices[0];
    if (!ch) return;
    if (ch.finish_reason === 'length') acc.finishReason = 'MAX_TOKENS';
    const dl = ch.delta || {};
    if (Array.isArray(dl.annotations)) dl.annotations.forEach(a => {
      const u = a && a.url_citation;
      if (u && /^https?:\/\//.test(u.url || '') && !acc.sources.some(x => x.uri === u.url)) acc.sources.push({ uri: u.url, title: u.title || u.url });
    });
    if (dl.content) emit(dl.content);
  }
};
