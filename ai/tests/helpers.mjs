// Testler için ortak yardımcılar: sahte localStorage, sahte fetch, sahte akış yanıtı.
export function installLocalStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _map: m
  };
  return globalThis.localStorage;
}

export const CREDS = { apiKey: 'AIzaFAKEKEY', orKey: 'sk-or-FAKE', getIdToken: () => null };

export const sse = (...objs) => objs.map(o => (o === '[DONE]' ? 'data: [DONE]\n\n' : 'data: ' + JSON.stringify(o) + '\n\n')).join('');
export const gText = (t, extra) => ({ candidates: [Object.assign({ content: { parts: [{ text: t }] } }, extra || {})] });
export const orText = (t, extra) => ({ choices: [Object.assign({ delta: { content: t } }, extra || {})] });

// Sıradaki yanıtı veren sahte fetch. Her sağlayıcı için ayrı kuyruk: { gem: [...], or: [...] }.
// Yanıt biçimleri: { sse: '...' } | { status, json } | { throw: Error } | { hang: true } (akış hiç veri vermez, iptale tepki verir)
export function fakeFetch(queues) {
  const calls = [];
  const fn = async (url, init) => {
    const key = url.includes('openrouter.ai') ? 'or' : 'gem';
    const q = queues[key] || [];
    const spec = q.length > 1 ? q.shift() : q[0];
    calls.push({ key, url, init, body: JSON.parse(init.body) });
    if (!spec) throw new Error('fakeFetch: ' + key + ' için yanıt tanımlı değil');
    if (spec.throw) throw spec.throw;
    if (init.signal && init.signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    if (spec.hang) {
      const body = new ReadableStream({
        start(c) { init.signal.addEventListener('abort', () => c.error(Object.assign(new Error('aborted'), { name: 'AbortError' }))); }
      });
      return new Response(body, { status: 200 });
    }
    if (spec.sse !== undefined) return new Response(spec.sse, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    return new Response(JSON.stringify(spec.json || {}), { status: spec.status, headers: Object.assign({ 'content-type': 'application/json' }, spec.headers || {}) });
  };
  fn.calls = calls;
  return fn;
}

export const abortError = () => Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
