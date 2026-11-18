import test from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage, CREDS, sse, gText, orText, fakeFetch, abortError } from './helpers.mjs';

const { MODELS, hasKeyFor, keyOk, curModel, poolOf } = await import('../engines/models.js');
const { classifyRequest, rankModels, planRequest } = await import('../engines/router.js');
const { detectQuotaInfo, parseRetrySeconds, nextUtcMidnight } = await import('../engines/quota.js');
const { formatFailure, mkErr } = await import('../engines/errors.js');
const { Health, isCooled, recordHealth, healthKeys } = await import('../engines/health.js');
const { gemini } = await import('../engines/providers/gemini.js');
const { openrouter } = await import('../engines/providers/openrouter.js');
const { hasMedia } = await import('../engines/media.js');
const { runWithFallback } = await import('../engines/index.js');
const { buildSystemText, BASE_IDENTITY, RICH_UI_HINT, ANSWER_STYLE } = await import('../prompts.js');

const M = (id) => MODELS.find(m => m.id === id);
const ids = (list) => list.map(m => m.id);
const textHist = (t) => [{ role: 'user', msgText: t, images: [], pdfs: [] }];
const IMG = { dataUrl: 'data:image/png;base64,AAAA' };
const PDF = { mimeType: 'application/pdf', base64Data: 'BBBB', name: 'a.pdf' };
const GEM = { apiKey: 'AIzaX', orKey: '', getIdToken: () => null };
const ORK = { apiKey: '', orKey: 'sk-or', getIdToken: () => null };

test.beforeEach(() => installLocalStorage());

// ---------------- models / anahtar kontrolü ----------------
test('hasKeyFor: Gemini anahtarı AIza ile başlamalı, OpenRouter için orKey yeterli', () => {
  assert.equal(hasKeyFor(M('g25'), { apiKey: 'AIzaX', orKey: '' }), true);
  assert.equal(hasKeyFor(M('g25'), { apiKey: 'yanlis', orKey: '' }), false);
  assert.equal(hasKeyFor(M('f2'), { apiKey: '', orKey: 'k' }), true);
  assert.equal(hasKeyFor(M('f2'), { apiKey: 'AIzaX', orKey: '' }), false);
});

test('keyOk / curModel: kayıtlı motor seçilir, yoksa Otomatik', () => {
  assert.equal(curModel().id, 'auto');
  assert.equal(keyOk({ apiKey: '', orKey: '' }), false);
  assert.equal(keyOk(GEM), true);
  localStorage.setItem('forge_ai_v66_model', 'f2');
  assert.equal(curModel().id, 'f2');
  assert.equal(keyOk(GEM), false);
  assert.equal(keyOk(ORK), true);
  localStorage.setItem('forge_ai_v66_model', 'yok');
  assert.equal(curModel().id, 'auto');
});

test('poolOf: OpenRouter :free modelleri tek havuzu paylaşır', () => {
  assert.equal(poolOf(M('f2')), poolOf(M('f3')));
  assert.notEqual(poolOf(M('g25')), poolOf(M('g20')));
});

// ---------------- router ----------------
test('classifyRequest', () => {
  const none = { vision: false, pdf: false };
  assert.equal(classifyRequest('merhaba', none), 'simple');
  assert.equal(classifyRequest('bir python fonksiyon yaz', none), 'code');
  assert.equal(classifyRequest('```js\nlet a\n```', none), 'code');
  assert.equal(classifyRequest('bunu ayrıntılı analiz et', none), 'analysis');
  assert.equal(classifyRequest('x'.repeat(600), none), 'analysis');
  assert.equal(classifyRequest('x'.repeat(3100), none), 'document');
  assert.equal(classifyRequest('merhaba', { vision: true, pdf: true }), 'vision');
  assert.equal(classifyRequest('merhaba', { vision: false, pdf: true }), 'pdf');
});

test('rankModels: tür önceliğine göre sıralar, eşitte katalog sırasını korur', () => {
  const all = MODELS.filter(m => !m.auto && !m.noAuto);
  assert.deepEqual(ids(rankModels(all, 'simple')), ['g20', 'f3', 'f4', 'f1', 'g25', 'f2', 'f5']);
  assert.deepEqual(ids(rankModels(all, 'code')), ['f5', 'f1', 'g25', 'f2', 'f4', 'g20', 'f3']);
  assert.deepEqual(ids(rankModels(all, 'analysis')), ['f1', 'g25', 'f2', 'f4', 'g20', 'f3', 'f5']);
});

test('planRequest (otomatik): anahtarı olmayan motorlar adaylara girmez', () => {
  const p = planRequest({ selected: M('auto'), hist: textHist('merhaba'), creds: GEM });
  assert.deepEqual(ids(p.candidates), ['g20', 'f1', 'g25']);   // g15 noAuto
  assert.equal(p.reqType, 'simple');
  const q = planRequest({ selected: M('auto'), hist: textHist('merhaba'), creds: ORK });
  assert.deepEqual(ids(q.candidates), ['f3', 'f4', 'f2', 'f5']);
});

test('planRequest (otomatik): anahtar yoksa auth hatası', () => {
  assert.throws(() => planRequest({ selected: M('auto'), hist: textHist('x'), creds: { apiKey: '', orKey: '' } }), (e) => e.kind === 'auth');
});

test('planRequest (otomatik): fotoğraf varsa yalnızca görsel okuyabilen motorlar', () => {
  const hist = [{ role: 'user', msgText: 'bu ne', images: [IMG], pdfs: [] }];
  const p = planRequest({ selected: M('auto'), hist, creds: CREDS });
  assert.ok(p.candidates.every(m => m.vision));
  assert.equal(p.reqType, 'vision');
  const onlyText = planRequest({ selected: M('auto'), hist, creds: ORK });
  assert.deepEqual(ids(onlyText.candidates), ['f4']);
});

test('planRequest (otomatik): PDF için yalnızca PDF okuyan motor; yoksa unsupported', () => {
  const hist = [{ role: 'user', msgText: 'oku', images: [], pdfs: [PDF] }];
  assert.ok(planRequest({ selected: M('auto'), hist, creds: GEM }).candidates.every(m => m.pdf));
  assert.throws(() => planRequest({ selected: M('auto'), hist, creds: ORK }), (e) => e.kind === 'unsupported');
});

test('planRequest (otomatik): kotası dolu motorlar atlanır; hepsi doluysa quota hatası (en erken sıfırlanma)', () => {
  const soon = Date.now() + 60000, later = Date.now() + 120000;
  Health.set(poolOf(M('g20')), 'quota', soon, { quota: { resetAt: soon } });
  const p = planRequest({ selected: M('auto'), hist: textHist('merhaba'), creds: GEM });
  assert.deepEqual(ids(p.candidates), ['f1', 'g25']);
  Health.set(poolOf(M('f1')), 'quota', later, { quota: { resetAt: later } });
  Health.set(poolOf(M('g25')), 'quota', later, { quota: { resetAt: later } });
  assert.throws(() => planRequest({ selected: M('auto'), hist: textHist('merhaba'), creds: GEM }), (e) => e.kind === 'quota' && e.quota.resetAt === soon);
});

test('planRequest (manuel): tek aday; anahtar/ek/kota denetimleri', () => {
  assert.deepEqual(ids(planRequest({ selected: M('g25'), hist: textHist('x'), creds: GEM }).candidates), ['g25']);
  assert.throws(() => planRequest({ selected: M('g25'), hist: textHist('x'), creds: ORK }), (e) => e.kind === 'auth');
  const img = [{ role: 'user', msgText: 'x', images: [IMG], pdfs: [] }];
  assert.throws(() => planRequest({ selected: M('f2'), hist: img, creds: ORK }), (e) => e.kind === 'unsupported');
  assert.doesNotThrow(() => planRequest({ selected: M('f4'), hist: img, creds: ORK }));
  const t = Date.now() + 60000;
  Health.set(poolOf(M('g25')), 'quota', t, { quota: { resetAt: t } });
  assert.throws(() => planRequest({ selected: M('g25'), hist: textHist('x'), creds: GEM }), (e) => e.kind === 'quota' && e.quota.model === M('g25').label);
});

// ---------------- kota / hata metinleri ----------------
test('parseRetrySeconds', () => {
  assert.equal(parseRetrySeconds('30s'), 30);
  assert.equal(parseRetrySeconds('1.2s'), 2);
  assert.equal(parseRetrySeconds('abc'), null);
  assert.equal(parseRetrySeconds(undefined), null);
});

test('detectQuotaInfo: RetryInfo, günlük kota, OpenRouter sıfırlanma başlığı, varsayılan', () => {
  const t0 = Date.now();
  const a = detectQuotaInfo({ error: { details: [{ '@type': 'x/RetryInfo', retryDelay: '30s' }] } }, null, false, 'Etiket');
  assert.ok(a.resetAt >= t0 + 29000 && a.resetAt <= Date.now() + 31000);
  assert.deepEqual([a.daily, a.approx, a.model, a.provider], [false, false, 'Etiket', 'gemini']);
  const d = detectQuotaInfo({ error: { details: [{ '@type': 'x/QuotaFailure', violations: [{ quotaId: 'RequestsPerDay' }] }] } }, null, false, '');
  assert.equal(d.daily, true);
  const or = detectQuotaInfo({ error: { message: 'daily limit' } }, null, true, '');
  assert.equal(or.daily, true); assert.equal(or.resetAt, nextUtcMidnight()); assert.equal(or.provider, 'openrouter');
  const future = Date.now() + 600000;
  const hdr = detectQuotaInfo({ error: { metadata: { headers: { 'X-RateLimit-Reset': String(future) } } } }, null, true, '');
  assert.equal(hdr.resetAt, future);
  const def = detectQuotaInfo({ error: { message: 'bilinmiyor' } }, null, false, '');
  assert.equal(def.approx, true);
});

test('formatFailure: tür başlığı, tavsiye ve ayrıntı; karışık hatada motor listesi', () => {
  const a = formatFailure(mkErr('auth', 'HTTP 401'));
  assert.ok(a.includes('API anahtarı sorunu') && a.includes('Ayrıntı: HTTP 401'));
  const mixed = Object.assign(new Error('x'), { kind: 'mixed', attempts: [{ model: M('g25'), kind: 'quota' }, { model: M('f2'), kind: 'network' }] });
  const t = formatFailure(mixed);
  assert.ok(t.includes('Hiçbir motor yanıt veremedi') && t.includes('- Oforge 2.5 Flash: kota dolu') && t.includes('- Oforge 2: bağlantı hatası'));
  assert.ok(formatFailure(new Error('?')).includes('Motor hatası'));
});

// ---------------- sağlık kaydı ----------------
test('recordHealth: hata türüne göre doğru anahtar ve süre', () => {
  const g = M('g25'), now = Date.now();
  recordHealth(g, { kind: 'notfound' });  assert.equal(Health.get('m:g25').kind, 'notfound');
  recordHealth(g, { kind: 'auth' });      assert.equal(Health.get('p:gemini').kind, 'auth');
  recordHealth(M('f2'), { kind: 'quota', quota: { resetAt: now + 100000 } });
  assert.equal(Health.get(poolOf(M('f2'))).until, now + 100000);
  assert.equal(isCooled(M('f3')).kind, 'quota');                 // aynı havuz
  recordHealth(M('f4'), { kind: 'empty' }); assert.equal(Health.get('m:f4').kind, 'empty');
  recordHealth(M('f5'), { kind: 'badrequest' }); assert.equal(Health.get('m:f5'), null);   // kaydedilmez
});

test('Health: süresi dolan kayıt silinir; drop ve clearAll çalışır', () => {
  Health.set('a', 'x', Date.now() - 1);
  assert.equal(Health.get('a'), null);
  assert.equal('a' in Health.all(), false);
  Health.set('b', 'x', Date.now() + 1000); Health.set('c', 'x', Date.now() + 1000);
  Health.drop(healthKeys(M('g25')).concat(['b']));
  assert.equal(Health.get('b'), null); assert.ok(Health.get('c'));
  Health.clearAll(); assert.equal(Health.get('c'), null);
});

// ---------------- sağlayıcılar ----------------
test('gemini.buildContents: metin + görsel + PDF sırası, rol dönüşümü, boş girdiler atlanır', () => {
  const hist = [
    { role: 'user', msgText: 'a', images: [IMG], pdfs: [PDF] },
    { role: 'assistant', msgText: 'b', images: [], pdfs: [] },
    { role: 'user', msgText: '', images: [], pdfs: [] }
  ];
  const c = gemini.buildContents(hist, M('g25'));
  assert.equal(c.length, 2);
  assert.deepEqual(c[0].parts, [{ text: 'a' }, { inlineData: { mimeType: 'image/png', data: 'AAAA' } }, { inlineData: { mimeType: 'application/pdf', data: 'BBBB' } }]);
  assert.equal(c[1].role, 'model');
});

test('openrouter.buildMessages: görsel desteklenmiyorsa not eklenir, desteklenirse image_url', () => {
  const hist = [{ role: 'user', msgText: 'bu ne', images: [IMG], pdfs: [PDF] }];
  const textOnly = openrouter.buildMessages(hist, M('f2'));
  assert.equal(textOnly.length, 1);
  assert.equal(typeof textOnly[0].content, 'string');
  assert.ok(textOnly[0].content.includes('görselleri okuyamıyor') && textOnly[0].content.includes('PDF okuyamıyor'));
  const vision = openrouter.buildMessages(hist, M('f4'));
  assert.ok(Array.isArray(vision[0].content) && vision[0].content.some(p => p.type === 'image_url'));
  assert.equal(openrouter.buildMessages([{ role: 'assistant', msgText: 'x', images: [], pdfs: [] }], M('f2'))[0].content, 'x');
});

test('hasMedia: yalnızca motorun gerçekten göndereceği ekleri sayar', () => {
  const hist = [{ role: 'user', msgText: '', images: [IMG], pdfs: [] }];
  assert.equal(hasMedia(hist, M('g25')), true);
  assert.equal(hasMedia(hist, M('f2')), false);
  assert.equal(hasMedia([{ role: 'user', msgText: 'a', images: [{ dataUrl: 'bozuk' }], pdfs: [] }], M('g25')), false);
});

test('uç nokta ve başlıklar: doğrudan Gemini, proxy, OpenRouter', () => {
  assert.equal(gemini.endpoint(M('g25'), ''), 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse');
  assert.equal(gemini.endpoint(M('g25'), 'https://p.example/'), 'https://p.example/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse');
  assert.equal(gemini.headers(GEM, '')['x-goog-api-key'], 'AIzaX');
  assert.equal(gemini.headers({ getIdToken: () => 'tok' }, 'https://p')['Authorization'], 'Bearer tok');
  assert.throws(() => gemini.checkAuth({ getIdToken: () => null }, 'https://p'), (e) => e.kind === 'auth');
  assert.doesNotThrow(() => gemini.checkAuth(GEM, ''));
  assert.equal(openrouter.headers(ORK).Authorization, 'Bearer sk-or');
  assert.ok(openrouter.endpoint().startsWith('https://openrouter.ai/'));
});

test('buildBody: web araması aracı yalnızca açıkken eklenir', () => {
  const base = { hist: textHist('x'), systemText: 'S' };
  assert.equal(JSON.parse(gemini.buildBody({ model: M('g25'), webOn: true, ...base })).tools[0].googleSearch !== undefined, true);
  assert.equal('tools' in JSON.parse(gemini.buildBody({ model: M('g25'), webOn: false, ...base })), false);
  assert.deepEqual(JSON.parse(openrouter.buildBody({ model: M('f2'), webOn: true, ...base })).plugins, [{ id: 'web' }]);
  assert.equal(JSON.parse(openrouter.buildBody({ model: M('f2'), webOn: false, ...base })).messages[0].content, 'S');
});

test('buildSystemText: kimlik + (varsa) kullanıcı adı + biçim ve üslup kuralları', () => {
  assert.equal(buildSystemText('SP', null), 'SP' + RICH_UI_HINT + ANSWER_STYLE);
  assert.ok(buildSystemText('SP', { name: 'Ali' }).includes('kullanıcının adı: Ali'));
  assert.ok(BASE_IDENTITY.includes('Oforge AI'));
});

// ---------------- runWithFallback ----------------
const geminiOK = (...ts) => ({ sse: sse(...ts.map(t => gText(t)), { candidates: [{ content: { parts: [{ text: '' }] }, finishReason: 'STOP' }] }) });
const orOK = (...ts) => ({ sse: sse(...ts.map(t => orText(t)), '[DONE]') });
const run = (candidates, queues, extra = {}) => {
  const f = fakeFetch(queues);
  const events = { text: [], stages: [], starts: 0 };
  const p = runWithFallback({
    candidates: candidates.map(M), hist: textHist('merhaba'), systemText: 'S', webOn: false, creds: CREDS,
    signal: (extra.controller || new AbortController()).signal, fetchImpl: f, proxyUrl: '',
    hooks: { onAttemptStart: () => events.starts++, onStage: (s, i) => events.stages.push([s, i && i.media, i && i.to && i.to.id]), onText: (t) => events.text.push(t) },
    ...extra.opts
  });
  return { p, f, events };
};

test('başarılı Gemini denemesi: olay sırası ve metin parçaları', async () => {
  const { p, f, events } = run(['g25'], { gem: [geminiOK('Mer', 'haba')] });
  const r = await p;
  assert.equal(r.model.id, 'g25'); assert.deepEqual(r.attempts, []);
  assert.deepEqual(events.text, ['Mer', 'haba']);
  assert.deepEqual(events.stages.map(s => s[0]), ['prepare', 'connect', 'stream']);
  assert.equal(events.stages[0][1], false); assert.equal(events.starts, 1);
  assert.equal(f.calls[0].init.headers['x-goog-api-key'], 'AIzaFAKEKEY');
});

test('başarılı OpenRouter denemesi', async () => {
  const r = await run(['f2'], { or: [orOK('OR ', 'yanıt')] }).p;
  assert.equal(r.model.id, 'f2');
});

test('kaynaklar tekrarsız toplanır, MAX_TOKENS bitiş nedeni taşınır', async () => {
  const ev = { candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'MAX_TOKENS', groundingMetadata: { groundingChunks: [{ web: { uri: 'https://a.com/1', title: 'A' } }, { web: { uri: 'https://a.com/1', title: 'dup' } }, { web: { uri: 'javascript:1', title: 'kötü' } }] } }] };
  const r = await run(['g25'], { gem: [{ sse: sse(ev) }] }).p;
  assert.deepEqual(r.sources, [{ uri: 'https://a.com/1', title: 'A' }]);
  assert.equal(r.finishReason, 'MAX_TOKENS');
  const o = await run(['f2'], { or: [{ sse: sse({ choices: [{ delta: { content: 'k' }, finish_reason: 'length' }] }, '[DONE]') }] }).p;
  assert.equal(o.finishReason, 'MAX_TOKENS');
});

test('düşünce (thought) parçaları yanıta karışmaz', async () => {
  const ev = { candidates: [{ content: { parts: [{ text: 'düşünce', thought: true }, { text: 'Gerçek' }] } }] };
  const { p, events } = run(['g25'], { gem: [{ sse: sse(ev) }] });
  await p; assert.deepEqual(events.text, ['Gerçek']);
});

test('kota hatası: bir sonraki motora geçer, sağlık kaydı tutulur, geçiş olayı yayılır', async () => {
  const q = { status: 429, json: { error: { status: 'RESOURCE_EXHAUSTED', message: 'quota', details: [{ '@type': 'x/RetryInfo', retryDelay: '30s' }] } } };
  const { p, f, events } = run(['g20', 'f3'], { gem: [q], or: [orOK('kurtardı')] });
  const r = await p;
  assert.equal(r.model.id, 'f3');
  assert.equal(r.attempts.length, 1); assert.equal(r.attempts[0].kind, 'quota');
  assert.equal(r.attempts[0].quota.model, 'Oforge 2.0 Flash');
  assert.equal(Health.get(poolOf(M('g20'))).kind, 'quota');
  assert.ok(events.stages.some(s => s[0] === 'switch' && s[2] === 'f3'));
  assert.equal(events.starts, 2); assert.equal(f.calls.length, 2);
});

test('başarı, o motorun sağlık kaydını temizler', async () => {
  Health.set('m:g25', 'overloaded', Date.now() + 100000);
  await run(['g25'], { gem: [geminiOK('ok')] }).p;
  assert.equal(Health.get('m:g25'), null);
});

test('anahtar hatası: aynı sağlayıcının diğer motorları atlanır', async () => {
  const { p, f } = run(['g25', 'g20', 'f3'], { gem: [{ status: 403, json: { error: { message: 'denied' } } }], or: [orOK('OR')] });
  const r = await p;
  assert.equal(r.model.id, 'f3'); assert.equal(f.calls.length, 2);
  assert.equal(Health.get('p:gemini').kind, 'auth');
});

test('ağ hatası: sağlayıcı atlanır; TypeError ağ hatası sayılır', async () => {
  const { p } = run(['g25', 'g20', 'f3'], { gem: [{ throw: new TypeError('failed to fetch') }], or: [orOK('OR')] });
  const r = await p;
  assert.equal(r.model.id, 'f3'); assert.equal(r.attempts[0].kind, 'network');
});

test('en fazla 3 deneme; hepsi aynı türde başarısızsa hata o türü taşır', async () => {
  const e503 = { status: 503, json: { error: { message: 'busy' } } };
  const { p, f } = run(['g25', 'g20', 'f2', 'f3', 'f4'], { gem: [e503], or: [e503] });
  await assert.rejects(p, (e) => e.kind === 'overloaded' && e.attempts.length === 3);
  assert.equal(f.calls.length, 3);
});

test('karışık başarısızlık: kind=mixed; hepsi kota ise en erken sıfırlanma taşınır', async () => {
  const e503 = { status: 503, json: { error: { message: 'busy' } } };
  const q = (t) => ({ status: 429, json: { error: { status: 'RESOURCE_EXHAUSTED', message: 'quota', metadata: { headers: { 'X-RateLimit-Reset': String(t) } } } } });
  await assert.rejects(run(['g25', 'f2'], { gem: [e503], or: [{ status: 401, json: { error: { message: 'x' } } }] }).p, (e) => e.kind === 'mixed');
  const t1 = Date.now() + 100000;
  await assert.rejects(run(['f2', 'g25'], { or: [q(t1)], gem: [{ status: 429, json: { error: { status: 'RESOURCE_EXHAUSTED', message: 'quota', details: [{ '@type': 'x/RetryInfo', retryDelay: '50s' }] } } }] }).p,
    (e) => e.kind === 'quota' && e.quota.resetAt < t1 && e.quota.resetAt > Date.now());
});

test('çok büyük istek ve güvenlik engeli başka motora denenmez', async () => {
  const huge = [{ role: 'user', msgText: 'x'.repeat(19 * 1024 * 1024 + 10), images: [], pdfs: [] }];
  const f = fakeFetch({ gem: [geminiOK('x')], or: [orOK('x')] });
  await assert.rejects(runWithFallback({ candidates: [M('g25'), M('f2')], hist: huge, systemText: 'S', webOn: false, creds: CREDS, signal: new AbortController().signal, fetchImpl: f, proxyUrl: '' }), (e) => e.kind === 'toolarge');
  assert.equal(f.calls.length, 0);
  const blocked = { sse: sse({ promptFeedback: { blockReason: 'SAFETY' } }) };
  const r = run(['g25', 'f2'], { gem: [blocked], or: [orOK('x')] });
  await assert.rejects(r.p, (e) => e.kind === 'blocked');
  assert.equal(r.f.calls.length, 1);
});

test('boş yanıt, akış içi hata ve HTTP kodu eşlemesi', async () => {
  await assert.rejects(run(['g25'], { gem: [{ sse: sse({ candidates: [{ content: { parts: [] }, finishReason: 'OTHER' }] }) }] }).p, (e) => e.kind === 'empty' && e.message.includes('OTHER'));
  await assert.rejects(run(['g25'], { gem: [{ sse: sse({ error: { message: 'Rate limit exceeded' } }) }] }).p, (e) => e.kind === 'quota' && !!e.quota);
  await assert.rejects(run(['g25'], { gem: [{ sse: sse({ error: { message: 'başka' } }) }] }).p, (e) => e.kind === 'other');
  for (const [status, kind] of [[400, 'badrequest'], [401, 'auth'], [402, 'billing'], [404, 'notfound'], [500, 'overloaded'], [418, 'other']]) {
    await assert.rejects(run(['g25'], { gem: [{ status, json: { error: { message: 'm' } } }] }).p, (e) => e.kind === kind, 'HTTP ' + status);
  }
});

test('iptal: AbortError olduğu gibi yükselir, sağlık kaydı tutulmaz', async () => {
  const controller = new AbortController();
  const { p } = run(['g25', 'f2'], { gem: [{ hang: true }], or: [orOK('x')] }, { controller });
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(p, (e) => e.name === 'AbortError');
  assert.deepEqual(Health.all(), {});
});

test('ilk metin zaman aşımı: yedek motor varsa timeout kaydedilir ve sıradakine geçilir', async () => {
  const { p } = run(['g25', 'f3'], { gem: [{ hang: true }], or: [orOK('yedek')] }, { opts: { firstTokenMs: 30 } });
  const r = await p;
  assert.equal(r.model.id, 'f3'); assert.equal(r.attempts[0].kind, 'timeout');
  assert.equal(Health.get('m:g25').kind, 'timeout');
});

test('yedek motor yoksa zaman aşımı beklenmez (tek aday)', async () => {
  const controller = new AbortController();
  const { p } = run(['g25'], { gem: [{ hang: true }] }, { controller, opts: { firstTokenMs: 10 } });
  setTimeout(() => controller.abort(), 60);
  await assert.rejects(p, (e) => e.name === 'AbortError');
});
