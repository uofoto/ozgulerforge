import test from 'node:test';
import assert from 'node:assert/strict';
const { buildSystemText, SUGGEST_OPEN, SUGGEST_CLOSE } = await import('../prompts.js');

test('sistem talimatı: öneri bloğu biçimini ve zorunluluğunu içerir', () => {
  const t = buildSystemText('', null);
  assert.ok(t.includes(SUGGEST_OPEN) && t.includes(SUGGEST_CLOSE));
  assert.ok(/EN SONUNA/.test(t));
  assert.ok(!/zorunlu değildir/.test(t));
  assert.ok(!/otomatik öneri, soru veya düğme ekleme/.test(t));
});

test('öneri bloğu ayrıştırma deseni: Gemini tarzı düğme listesi çıkarılır', () => {
  const re = new RegExp('\\n*' + SUGGEST_OPEN.replace(/[[\]]/g, '\\$&') + '([\\s\\S]*?)(?:' + SUGGEST_CLOSE.replace(/[[\]/]/g, '\\$&') + '|$)');
  const src = 'Ana yanıt.\n\n' + SUGGEST_OPEN + '\n- Groq API anahtarı\n- AI Studio anahtarı\n- Jeton yetki hatası\n' + SUGGEST_CLOSE;
  const m = re.exec(src);
  assert.ok(m);
  assert.equal(src.slice(0, m.index).trimEnd(), 'Ana yanıt.');
  assert.equal(m[1].split('\n').map(l => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean).length, 3);
});

const { parseSuggestions, suggestFollowUps } = await import('../engines/suggest.js');
const { CREDS, sse, orText, fakeFetch } = await import('./helpers.mjs');

test('parseSuggestions: madde işareti, numara ve tırnak temizlenir; en fazla 3 öneri', () => {
  assert.deepEqual(parseSuggestions('1. "Örnek kodu göster"\n- Daha kısa özetle\n* Karşıt görüşü anlat\n- Dördüncü öneri'), ['Örnek kodu göster', 'Daha kısa özetle', 'Karşıt görüşü anlat']);
  assert.deepEqual(parseSuggestions('[[ONERI]]\nx'), []);
  assert.deepEqual(parseSuggestions(''), []);
});

test('suggestFollowUps: yanıtı veren motordan öneri üretir; hata olursa boş dizi döner', async () => {
  const model = { id: 't', engine: 'lite', label: 'AI Lite', provider: 'groq', model: 'openai/gpt-oss-20b', tier: 'light', vision: false, pdf: false };
  const f = fakeFetch({ groq: [{ sse: sse(orText('- Örnek kodu göster\n- Daha kısa özetle\n'), orText('- Kaynak öner'), '[DONE]') }] });
  const list = await suggestFollowUps({ model, userText: 'soru', answerText: 'cevap', creds: CREDS, fetchImpl: f });
  assert.deepEqual(list, ['Örnek kodu göster', 'Daha kısa özetle', 'Kaynak öner']);
  assert.equal(f.calls.length, 1);
  const bad = fakeFetch({ groq: [{ status: 429, json: { error: { message: 'quota' } } }] });
  assert.deepEqual(await suggestFollowUps({ model, userText: 'a', answerText: 'b', creds: CREDS, fetchImpl: bad }), []);
});
