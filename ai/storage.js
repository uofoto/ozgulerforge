// Tarayıcı depolamasına açılan TEK kapı. Başka hiçbir modül localStorage'a doğrudan dokunmaz.
// Tüm işlemler güvenlidir: depolama kapalı/dolu/bozuksa hata fırlatmaz, varsayılan değeri döndürür.
// Yazma/silme başarıyı true/false ile bildirir; önemli veriyi yazanlar (örn. sohbetler) bunu kontrol edebilir.
import { KEYS } from './config.js';

function ls() { try { return globalThis.localStorage || null; } catch (_) { return null; } }

export const storage = {
  get(key, fallback = null) {
    try { const s = ls(); const v = s ? s.getItem(key) : null; return v === null || v === undefined ? fallback : v; } catch (_) { return fallback; }
  },
  set(key, value) {
    try { const s = ls(); if (!s) return false; s.setItem(key, value); return true; } catch (_) { return false; }
  },
  remove(key) {
    try { const s = ls(); if (!s) return false; s.removeItem(key); return true; } catch (_) { return false; }
  },
  getJSON(key, fallback = null) {
    const raw = this.get(key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  },
  setJSON(key, value) {
    try { return this.set(key, JSON.stringify(value)); } catch (_) { return false; }
  }
};

// Kayıtlı sohbetleri okur. Veri bozuksa SESSİZCE boş listeye düşmez: ham metni yedek anahtara kopyalar,
// böylece sonraki kayıt bozuk veriyi ezse bile kullanıcı yedeğe ulaşabilir.
export function loadChats() {
  const raw = storage.get(KEYS.CHATS);
  if (raw === null || raw === '') return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v;
  } catch (_) {}
  storage.set(KEYS.CHATS_CORRUPT, raw);
  console.warn('Kayıtlı sohbetler okunamadı; ham veri "' + KEYS.CHATS_CORRUPT + '" anahtarına yedeklendi.');
  return [];
}
