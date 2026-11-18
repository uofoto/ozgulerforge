// Aday motorları sırayla dener; kota/anahtar/ağ hatalarında bir sonrakine geçer. DOM'a dokunmaz.
//
// hooks (hepsi isteğe bağlı):
//   onAttemptStart()           her denemeden önce (arayüz biriken metni sıfırlar)
//   onStage(ad, bilgi)         'prepare' {media} · 'connect' · 'stream' · 'switch' {from, to, kind}
//   onText(parça)              yanıtın her yeni metin parçası için
import { mkErr } from './errors.js';
import { poolOf } from './models.js';
import { Health, healthKeys, recordHealth } from './health.js';
import { runAttempt, FIRST_TOKEN_MS } from './attempt.js';
import { PROXY_URL } from '../config.js';

export const MAX_ATTEMPTS = 3;                 // aynı istek en fazla 3 motora gönderilir

// creds: { apiKey, orKey, getIdToken }
// Döndürür: { model, attempts, sources, finishReason }. Hepsi başarısız olursa kind/attempts/quota taşıyan hata fırlatır.
export async function runWithFallback({ candidates, hist, systemText, webOn, creds, signal, hooks, proxyUrl = PROXY_URL, fetchImpl, firstTokenMs = FIRST_TOKEN_MS }) {
  const H = Object.assign({ onAttemptStart() {}, onStage() {}, onText() {} }, hooks);
  const ctx = { hist, systemText, webOn, creds, proxyUrl, signal, hooks: H, fetchImpl, firstTokenMs };
  const attempts = [];
  const skipProviders = new Set(), skipPools = new Set();
  const usable = (m) => !skipProviders.has(m.provider) && !skipPools.has(poolOf(m));
  let r = null, usedModel = null;
  for (let ci = 0; ci < candidates.length && attempts.length < MAX_ATTEMPTS; ci++) {
    const cm = candidates[ci];
    if (!usable(cm)) continue;
    const hasNext = candidates.slice(ci + 1).some(usable) && attempts.length < MAX_ATTEMPTS - 1;
    H.onAttemptStart();
    try { r = await runAttempt(cm, hasNext, ctx); usedModel = cm; Health.drop(healthKeys(cm)); break; }
    catch (e) {
      if (e.name === 'AbortError') throw e;
      e.kind = e.kind || 'other';
      recordHealth(cm, e);
      attempts.push({ model: cm, label: cm.label, kind: e.kind, message: e.message, quota: e.quota || null });
      if (e.kind === 'toolarge' || e.kind === 'blocked') break;               // aynı isteği başka motora göndermek işe yaramaz
      if (e.kind === 'network' && typeof navigator !== 'undefined' && navigator.onLine === false) break;           // çevrimdışıyken denemeye gerek yok
      if (e.kind === 'auth' || e.kind === 'billing' || e.kind === 'network') skipProviders.add(cm.provider);
      if (e.kind === 'quota') skipPools.add(poolOf(cm));
      const nextM = candidates.slice(ci + 1).find(usable);
      if (nextM && attempts.length < MAX_ATTEMPTS) H.onStage('switch', { from: cm, to: nextM, kind: e.kind });
    }
  }
  if (!r) {
    const allErr = new Error(attempts.map(a => a.message).join(' | '));
    allErr.attempts = attempts;
    allErr.kind = !attempts.length ? 'other' : attempts.every(a => a.kind === attempts[0].kind) ? attempts[0].kind : 'mixed';
    if (attempts.length && attempts.every(a => a.kind === 'quota' && a.quota)) allErr.quota = attempts.map(a => a.quota).reduce((x, y) => (x.resetAt <= y.resetAt ? x : y));
    throw allErr;
  }
  return { model: usedModel, attempts, sources: r.sources, finishReason: r.finishReason };
}
