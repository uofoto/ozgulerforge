// Yanıt sonunda öneri bloğu gelmediğinde (küçük modeller talimatı sık atlar) kısa bir ikinci istekle takip önerileri üretir.
// DOM'a dokunmaz. Sağlık kaydı tutmaz: başarısız olması asıl sohbetteki motor seçimini etkilemez.
import { runAttempt } from './attempt.js';

export const SUGGEST_SYSTEM = 'Sen bir sohbet arayüzünün öneri üreticisisin. Kullanıcının sorusunu ve asistanın yanıtını oku; kullanıcının sıradaki mesajı olabilecek 3 kısa öneri yaz. Kurallar: her satıra bir öneri; her öneri 2-7 kelime; kullanıcının kendi ağzından, doğrudan gönderilebilecek bir mesaj gibi; birbirinden farklı yönlere açılsın; yanıtta zaten söyleneni tekrar etmesin; kullanıcının yazdığı dilde yaz. Madde işareti, numara, tırnak, başlık veya açıklama yazma; yalnızca 3 satır yaz.';

export function parseSuggestions(text) {
  return String(text || '').split('\n')
    .map(l => l.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, '').replace(/^["\u201c\u201d'`]+|["\u201c\u201d'`]+$/g, '').trim())
    .filter(l => l.length > 2 && l.length <= 60 && !/^\[\[/.test(l))
    .slice(0, 3);
}

// model: yanıtı veren motor. Döndürür: string[] (başarısızlıkta boş dizi; hata fırlatmaz).
export async function suggestFollowUps({ model, userText, answerText, creds, proxyUrl = '', fetchImpl, signal, timeoutMs = 15000 }) {
  try {
    const ac = new AbortController();
    if (signal) signal.addEventListener('abort', () => ac.abort());
    const m = model.provider === 'gemini' ? { ...model, thinking: 'low' } : model;
    const prompt = 'Kullanıcı sorusu:\n' + String(userText || '').slice(0, 600) + '\n\nAsistan yanıtı:\n' + String(answerText || '').slice(0, 1500) + '\n\n3 öneriyi yaz:';
    let out = '';
    await runAttempt(m, false, {
      hist: [{ role: 'user', msgText: prompt, images: [], pdfs: [] }],
      systemText: SUGGEST_SYSTEM, webOn: false, creds, proxyUrl, signal: ac.signal, fetchImpl, firstTokenMs: timeoutMs,
      hooks: { onStage() {}, onText(p) { out += p; } }
    });
    return parseSuggestions(out);
  } catch (_) { return []; }
}
