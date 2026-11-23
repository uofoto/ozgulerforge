// Google Gemini: istek gövdesi, adres, başlıklar ve akış olaylarının çözülmesi. DOM'a dokunmaz.
import { DATA_URL } from '../media.js';

export const gemini = {
  id: 'gemini',

  buildContents(hist, model) {
    const contents = [];
    for (const h of hist) {
      const parts = [];
      if (h.msgText) parts.push({ text: h.msgText });
      h.images.forEach(img => {
        const match = img.dataUrl.match(DATA_URL);
        if (match && model.vision) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      });
      h.pdfs.forEach(pdf => {
        if (model.pdf) parts.push({ inlineData: { mimeType: pdf.mimeType, data: pdf.base64Data } });
      });
      if (parts.length) contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts });
    }
    return contents;
  },

  buildBody({ model, hist, systemText, webOn, proxyUrl }) {
    const payload = {
      systemInstruction: { parts: [{ text: systemText }] },
      contents: this.buildContents(hist, model),
      tools: webOn ? [{ googleSearch: {} }] : undefined,
      generationConfig: model.thinking ? { thinkingConfig: { thinkingLevel: model.thinking } } : undefined
    };
    if (!proxyUrl) return JSON.stringify(payload);
    return JSON.stringify({
      provider: 'gemini',
      model: model.model,
      body: payload
    });
  },

  endpoint(model, proxyUrl) {
    if (proxyUrl) return proxyUrl.replace(/\/$/, '');
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.model)}:streamGenerateContent?alt=sse`;
  },

  checkAuth(creds, proxyUrl) {
    if (!proxyUrl && !creds.apiKey) throw new Error('Gemini API anahtarı eksik.');
  },

  headers(creds, proxyUrl) {
    if (proxyUrl) return { 'Content-Type': 'application/json' };
    return { 'Content-Type': 'application/json', 'x-goog-api-key': creds.apiKey };
  },

  handleEvent(parsed, acc, emit) {
    if (parsed.promptFeedback && parsed.promptFeedback.blockReason) acc.blockReason = parsed.promptFeedback.blockReason;
    const cand = parsed.candidates && parsed.candidates[0];
    if (cand && cand.finishReason && cand.finishReason !== 'STOP') acc.finishReason = cand.finishReason;
    const gm = cand && cand.groundingMetadata;
    if (gm && Array.isArray(gm.groundingChunks)) gm.groundingChunks.forEach(c => {
      if (c.web && /^https?:\/\//.test(c.web.uri || '') && !acc.sources.some(x => x.uri === c.web.uri)) acc.sources.push({ uri: c.web.uri, title: c.web.title || c.web.uri });
    });
    const parts = cand && cand.content && cand.content.parts;
    if (Array.isArray(parts)) {
      for (const p of parts) {
        if (p.text && !p.thought) emit(p.text);
      }
    }
  }
};
