// Sunucu-gönderimli olay akışını ("data: {...}" satırları) okur. Bozuk satırlar sessizce atlanır.
export async function readEventStream(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (!payload || payload === '[DONE]') continue;
      try { onEvent(JSON.parse(payload)); } catch (_) {}
    }
  }
}
