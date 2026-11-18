// Sağlayıcı hata yanıtından kota/limit bilgisini çıkarır ve sıfırlanma zamanını hesaplar. Saf fonksiyonlar.

export function nextPacificMidnight(now) {
  now = now || new Date();
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = {};
  fmt.formatToParts(now).forEach(x => { p[x.type] = x.value; });
  const secs = (Number(p.hour) % 24) * 3600 + Number(p.minute) * 60 + Number(p.second);
  return now.getTime() + (86400 - secs) * 1000;
}
export function nextUtcMidnight(now) {
  const d = now || new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}
export function parseRetrySeconds(v) {
  const m = /^(\d+(?:\.\d+)?)s$/.exec(String(v || '').trim());
  return m ? Math.ceil(parseFloat(m[1])) : null;
}
export function detectQuotaInfo(errData, headers, isOR, modelLabel) {
  const err = (errData && errData.error) || {};
  const details = Array.isArray(err.details) ? err.details : [];
  let retrySec = null, daily = false;
  details.forEach(d => {
    const t = String((d && d['@type']) || '');
    if (/RetryInfo/.test(t)) { const s = parseRetrySeconds(d.retryDelay); if (s != null) retrySec = s; }
    if (/QuotaFailure/.test(t) && Array.isArray(d.violations)) {
      d.violations.forEach(v => { if (/PerDay|daily/i.test(String(v.quotaId || '') + ' ' + String(v.quotaMetric || ''))) daily = true; });
    }
  });
  const msg = String(err.message || (errData && errData.message) || '');
  if (!daily && /per[ -]day|daily|günlük/i.test(msg)) daily = true;
  const hget = (n) => { try { return headers && headers.get ? headers.get(n) : null; } catch (_) { return null; } };
  const ra = hget('retry-after');
  if (retrySec == null && ra && /^\d+$/.test(ra)) retrySec = parseInt(ra, 10);
  const md = err.metadata && err.metadata.headers;
  const orReset = (md && (md['X-RateLimit-Reset'] || md['x-ratelimit-reset'])) || hget('x-ratelimit-reset');
  let resetAt = null, approx = false;
  if (orReset && /^\d{10,}$/.test(String(orReset))) {
    let ts = Number(orReset); if (ts < 1e12) ts *= 1000;
    if (ts > Date.now()) resetAt = ts;
  }
  if (!resetAt && daily) resetAt = isOR ? nextUtcMidnight() : nextPacificMidnight();
  if (!resetAt && retrySec != null) resetAt = Date.now() + retrySec * 1000;
  if (!resetAt) { resetAt = Date.now() + 60000; approx = true; }
  return { resetAt, daily, approx, model: modelLabel || '', provider: isOR ? 'openrouter' : 'gemini' };
}
