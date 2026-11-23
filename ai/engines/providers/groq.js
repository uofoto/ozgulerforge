// Groq OpenAI-uyumlu Chat Completions sağlayıcısı + Tavily Web Arama desteği.
import { DATA_URL } from '../media.js';

function extractSearchQuery(hist) {
  const userMsgs = (hist || [])
    .filter(item => item && item.role === 'user' && typeof item.msgText === 'string' && item.msgText.trim())
    .map(item => item.msgText.trim());

  if (!userMsgs.length) return '';
  const last = userMsgs[userMsgs.length - 1];
  // Son mesaj çok kısaysa ("2026 yılına ait", "detay ver" gibi) bir önceki kullanıcı sorusuyla birleştir
  if (last.length < 35 && userMsgs.length > 1) {
    return `${userMsgs[userMsgs.length - 2]} ${last}`.slice(0, 300);
  }
  return last.slice(0, 300);
}

async function fetchTavilyContext(query, proxyUrl) {
  if (!query || !proxyUrl) return { error: 'Sorgu veya proxy adresi eksik.' };
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
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { error: `HTTP ${res.status} ${errText.slice(0, 120)}` };
  }
  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  if (!results.length) return { error: 'Tavily sonuç döndürmedi.' };

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
    const todayStr = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    const messages = [
      { role: 'system', content: `${systemText}\nBugünün tarihi: ${todayStr}.` },
      ...this.buildMessages(hist, model)
    ];
    let tavilySources = [];

    if (webOn && proxyUrl) {
      const query = extractSearchQuery(hist);
      try {
        const tavilyData = await fetchTavilyContext(query, proxyUrl);
        if (tavilyData && tavilyData.contextText) {
          tavilySources = tavilyData.sources || [];
          messages.push({
            role: 'system',
            content:
              `${tavilyData.contextText}\n\n` +
              `Yukarıdaki güncel web sonuçlarını kullanarak yanıt ver. Bugünün tarihi ${todayStr}'dir; 2026 yılı içinde bulunduğumuz yıldır, asla "henüz gerçekleşmedi" deme. Kaynakta olmayan tarih veya kesin sayı uydurma.`
          });
        } else {
          messages.push({
            role: 'system',
            content: `Bugünün tarihi ${todayStr}'dir. Web araması başarısız oldu. Hata detayı: "${tavilyData?.error || 'bilinmeyen'}". Kullanıcıya bu hata detayını aynen ilet; 2026 yılını gelecekte sanma.`
          });
        }
      } catch (e) {
        messages.push({
          role: 'system',
          content: `Bugünün tarihi ${todayStr}'dir. Web araması sırasında bağlantı hatası oluştu. Hata detayı: "${e.message}". Bunu kullanıcıya açıkça belirt.`
        });
      }
    }

    const payload = {
      model: model.model,
      stream: true,
      temperature: model.temperature,
      messages
    };

    const jsonBody = !proxyUrl
      ? JSON.stringify(payload)
      : JSON.stringify({
          provider: 'groq',
          model: model.model,
          body: payload
        });

    return { body: jsonBody, sources: tavilySources };
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
