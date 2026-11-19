// Hafif bağlam belleği: yalnızca mevcut konuşma geçmişinden kısa ve güvenli sinyaller çıkarır.
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
export function buildConversationContext(history = [], limit = 5) {
  const turns = (Array.isArray(history) ? history : []).filter(x => x && x.role && clean(x.msgText))
    .slice(-Math.max(1, limit)).map(x => ({ role: x.role === 'assistant' ? 'assistant' : 'user', text: clean(x.msgText).slice(0, 900) }));
  const userTurns = turns.filter(x => x.role === 'user');
  return { turns, userTurnCount: userTurns.length, hasPriorContext: turns.length > 1,
    lastUserText: userTurns.at(-1)?.text || '', previousUserText: userTurns.at(-2)?.text || '' };
}
