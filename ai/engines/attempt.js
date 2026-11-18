// Tek bir motora tek bir deneme: istek kur → gönder → akışı oku → hataları sınıflandır. DOM'a dokunmaz.
// Arayüzle konuşma yolu yalnızca "hooks" geri çağrılarıdır (onStage, onText).
import { mkErr } from './errors.js';
import { detectQuotaInfo } from './quota.js';
import { readEventStream } from './stream.js';
import { providerOf } from './providers/index.js';
import { hasMedia } from './media.js';

export const FIRST_TOKEN_MS = 45000;           // ilk metin bu sürede gelmezse (ve yedek motor varsa) deneme iptal edilir
const MAX_BODY_CHARS = 19 * 1024 * 1024;       // ~20 MB sağlayıcı sınırının altında kal

// ctx: { hist, systemText, webOn, creds, proxyUrl, signal, hooks, fetchImpl, firstTokenMs }
// Döndürür: { sources, finishReason }. Hata durumunda e.kind ile sınıflandırılmış hata fırlatır.
export async function runAttempt(model, canFallback, ctx) {
  const { hist, systemText, webOn, creds, proxyUrl, signal, hooks, fetchImpl, firstTokenMs } = ctx;
  const label = model.label;
  const isOR = model.provider === 'openrouter';
  const provider = providerOf(model);
  const doFetch = fetchImpl || ((...a) => fetch(...a));

  const ac = new AbortController();
  const relay = () => ac.abort();
  signal.addEventListener('abort', relay);
  let timedOut = false, gotText = false;
  const timer = canFallback ? setTimeout(() => { if (!gotText) { timedOut = true; ac.abort(); } }, firstTokenMs) : null;
  try {
    hooks.onStage('prepare', { media: hasMedia(hist, model) });
    const requestBody = provider.buildBody({ model, hist, systemText, webOn });
    if (requestBody.length > MAX_BODY_CHARS) throw mkErr('toolarge', 'Gönderilecek belge/fotoğraf boyutu yaklaşık 20 MB sınırını aşıyor.');

    hooks.onStage('connect');
    const endpoint = provider.endpoint(model, proxyUrl);
    provider.checkAuth(creds, proxyUrl);
    const headers = provider.headers(creds, proxyUrl);
    let response;
    try {
      response = await doFetch(endpoint, { method: 'POST', signal: ac.signal, headers, body: requestBody });
    } catch (netErr) {
      if (netErr.name === 'AbortError') throw netErr;
      throw mkErr('network', `[${label}] Bağlantı kurulamadı: ${netErr.message}`);
    }
    if (!response.ok) {
      const status = response.status;
      const errData = await response.json().catch(() => ({}));
      const apiMsg = (errData.error && errData.error.message) || errData.message || '';
      const hints = {
        400: 'İstek geçersiz (model veya içerik desteklenmiyor olabilir).',
        401: 'API anahtarı geçersiz.',
        402: 'Bakiye/kredi yetersiz.',
        403: 'API anahtarının bu modele erişim izni yok veya anahtar kısıtlı.',
        404: 'Model adı bulunamadı.',
        429: 'Kota/oran sınırı aşıldı.',
        503: 'Model şu an yoğun, geçici olarak yanıt veremiyor.'
      };
      const httpErr = new Error(`[${label} • HTTP ${status}] ${hints[status] || ''} ${apiMsg}`.trim());
      if (status === 429 || (errData.error && errData.error.status === 'RESOURCE_EXHAUSTED')) { httpErr.kind = 'quota'; httpErr.quota = detectQuotaInfo(errData, response.headers, isOR, label); }
      else httpErr.kind = (status === 401 || status === 403) ? 'auth' : status === 402 ? 'billing' : status === 404 ? 'notfound' : status >= 500 ? 'overloaded' : status === 400 ? 'badrequest' : 'other';
      throw httpErr;
    }
    hooks.onStage('stream');

    const acc = { text: '', sources: [], finishReason: '', blockReason: '', streamError: '' };
    const emit = (piece) => { gotText = true; acc.text += piece; hooks.onText(piece); };
    await readEventStream(response, (parsed) => {
      if (parsed.error) { acc.streamError = parsed.error.message || 'Akış sırasında hata oluştu.'; return; }
      provider.handleEvent(parsed, acc, emit);
    });

    if (!acc.text.trim()) {
      if (acc.streamError) {
        const se = mkErr(/quota|rate.?limit|resource.?exhausted|429/i.test(acc.streamError) ? 'quota' : 'other', `[${label}] ${acc.streamError}`);
        if (se.kind === 'quota') se.quota = detectQuotaInfo({ error: { message: acc.streamError } }, null, isOR, label);
        throw se;
      }
      if (acc.blockReason) throw mkErr('blocked', `İstek güvenlik filtresi tarafından engellendi (${acc.blockReason}).`);
      throw mkErr('empty', `[${label}] Model boş yanıt döndürdü${acc.finishReason ? ' (' + acc.finishReason + ')' : ''}.`);
    }
    return { sources: acc.sources, finishReason: acc.finishReason };
  } catch (e) {
    if (timedOut && e.name === 'AbortError') throw mkErr('timeout', `[${label}] ${firstTokenMs / 1000} sn içinde yanıt gelmedi.`);
    if (e.name !== 'AbortError' && !e.kind) e.kind = (e instanceof TypeError) ? 'network' : 'other';
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
    signal.removeEventListener('abort', relay);
  }
}
