// Groq OpenAI-uyumlu Chat Completions sağlayıcısı + Tavily Web Arama desteği.
import { DATA_URL } from '../media.js';

function extractLastUserQuery(hist) {
  for (let i = (hist || []).length - 1; i >= 0; i--) {
    const item = hist[i];
    if (item && item.role === 'user' && typeof item.msgText === 'string' && item.msgText.trim()) {
      return item.msgText.trim();
    }
  }
  return '';
}

async function fetchTavilyContext(query, proxyUrl) {
  if (!query || !proxyUrl) return null;
  const endpoint = proxyUrl.replace(/\/$/, '');
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'tavily',
      query,
      maxResults: 5
    })
  });
  if (!res.ok) return null;
  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  if (!results.length) return null;

  const sources = [];
  const lines = results.map((r, idx) => {
    const title = r?.title || `Kaynak ${idx + 1}`;
    const url = r?.url || '';
    const content = String(r?.content || '').trim();
    if (/^https?:\/\//.test(url) && !sources.some(s => s.uri === url)) {
      sources.push({ uri: url, title });
    }
    return `[${idx + 1}] ${title}${url ? ` (${url})` : ''}\n${content}`;
  });

  return {
    contextText: `Güncel Web Arama Sonuçları ("${query}"):\n\n${lines.join('\n\n')}`,
    sources
  };
}

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
  async buildBody({ model, hist, systemText, webOn, proxyUrl }) {
    const messages = [{ role: 'system', content: systemText }, ...this.buildMessages(hist, model)];
    let tavilySources = [];

    if (webOn && proxyUrl) {
      const query = extractLastUserQuery(hist);
      try {
        const tavilyData = await fetchTavilyContext(query, proxyUrl);
        if (tavilyData && tavilyData.contextText) {
          tavilySources = tavilyData.sources || [];
          messages.push({
            role: 'system',
            content: `${tavilyData.contextText}\n\nYukarıdaki güncel web sonuçlarını kullanarak yanıt ver. Tarih ve güncel bilgi gerektiren kısımlarda bu kaynaklara dayan; kaynaklarda olmayan kesin tarih/sayı uydurma.`
          });
        }
      } catch {
        // Arama hatasında normal Groq yanıtına düş
      }
    }

    const payload = {
      model: model.model,
      stream: true,
      temperature: model.temperature,
      messages,
      _tavilySources: tavilySources
    };

    const cleanPayload = { ...payload };
    delete cleanPayload._tavilySources;

    if (!proxyUrl) return JSON.stringify(cleanPayload);
    return JSON.stringify({
      provider: 'groq',
      model: model.model,
      body: cleanPayload
    });
  },
  endpoint(model, proxyUrl) {
    if (proxyUrl) return proxyUrl.replace(/\/$/, '');
    return 'https://api.groq.com/openai/v1/chat/completions';
  },
  checkAuth(creds, proxyUrl) {
    if (!proxyUrl && !creds.groqKey) throw Object.assign(new Error('Groq API anahtarı eksik.'), { kind: 'auth' });
  },
  headers(creds, proxyUrl) {
    if (proxyUrl) return { 'Content-Type': 'application/json' };
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + creds.groqKey };
  },
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
