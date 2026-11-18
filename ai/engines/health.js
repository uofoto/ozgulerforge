// Hangi motorun neden bir süre denenmeyeceğini hatırlar (aynı hatalı isteğin tekrar tekrar gönderilmesini önler).
import { KEYS } from '../config.js';
import { storage } from '../storage.js';
import { poolOf } from './models.js';

export const Health = {
  all() { return storage.getJSON(KEYS.HEALTH, {}) || {}; },
  put(o) { storage.setJSON(KEYS.HEALTH, o); },
  set(key, kind, until, extra) { const o = this.all(); o[key] = Object.assign({ kind, until }, extra || {}); this.put(o); },
  get(key) { const o = this.all(), e = o[key]; if (!e) return null; if (e.until <= Date.now()) { delete o[key]; this.put(o); return null; } return e; },
  drop(keys) { const o = this.all(); keys.forEach(k => delete o[k]); this.put(o); },
  clearAll() { storage.remove(KEYS.HEALTH); }
};
export function healthKeys(m) { return ['m:' + m.id, poolOf(m), 'p:' + m.provider]; }
export function isCooled(m) { for (const k of healthKeys(m)) { const e = Health.get(k); if (e) return e; } return null; }
export function recordHealth(m, e) {
  const k = e.kind, now = Date.now();
  if (k === 'notfound') Health.set('m:' + m.id, k, now + 12 * 3600e3);
  else if (k === 'quota') Health.set(poolOf(m), 'quota', Math.max((e.quota && e.quota.resetAt) || 0, now + 30000), { quota: e.quota || null });
  else if (k === 'auth' || k === 'billing') Health.set('p:' + m.provider, k, now + 10 * 60e3);
  else if (k === 'network') Health.set('p:' + m.provider, k, now + 60e3);
  else if (k === 'overloaded' || k === 'timeout' || k === 'empty') Health.set('m:' + m.id, k, now + 2 * 60e3);
}
