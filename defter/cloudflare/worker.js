// Defter eşitleme Worker'ı. Veriyi hiç çözmez: notlar istemcide şifrelenir.
// Gerekenler: D1 bağlantısı "DB", gizli değer "SYNC_TOKEN" (en az 24 karakter), isteğe bağlı "ALLOWED_ORIGIN".
const MAX_PUSH = 100, MAX_D = 280000, PULL = 150, ROWS = 18;
class Bad extends Error {}
const J = (o, s, h) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...h } });

async function authed(req, env) {
  const t = env.SYNC_TOKEN;
  if (!t || t.length < 24) return false;
  const h = req.headers.get('Authorization') || '';
  if (!h.startsWith('Bearer ')) return false;
  const e = new TextEncoder();
  const a = new Uint8Array(await crypto.subtle.digest('SHA-256', e.encode(h.slice(7))));
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', e.encode(t)));
  let d = 0;
  for (let i = 0; i < 32; i++) d |= a[i] ^ b[i];
  return d === 0;
}
async function body(req) {
  const t = await req.text();
  if (t.length > 6e6) throw new Bad('istek çok büyük');
  try { return JSON.parse(t); } catch (e) { throw new Bad('geçersiz JSON'); }
}
async function info(DB) {
  const r = await DB.batch([
    DB.prepare('SELECT k, v FROM cfg'),
    DB.prepare('SELECT rev FROM counter WHERE id = 1'),
    DB.prepare('SELECT COUNT(*) AS n FROM notes'),
  ]);
  const cfg = Object.fromEntries(r[0].results.map(x => [x.k, x.v]));
  return { salt: cfg.salt || null, check: cfg.check || null, rev: r[1].results[0] ? r[1].results[0].rev : 0, count: r[2].results[0].n };
}
async function sync(DB, b) {
  const since0 = Number.isSafeInteger(b.since) && b.since >= 0 ? b.since : 0;
  const raw = Array.isArray(b.push) ? b.push : [];
  if (raw.length > MAX_PUSH) throw new Bad('çok fazla not');
  const byId = new Map();
  for (const p of raw) {
    if (!p || typeof p.id !== 'string' || !/^[\w:.-]{1,64}$/.test(p.id) || !Number.isSafeInteger(p.m) || p.m < 0 ||
        typeof p.d !== 'string' || p.d.length < 20 || p.d.length > MAX_D) throw new Bad('geçersiz not');
    const o = byId.get(p.id);
    if (!o || p.m > o.m) byId.set(p.id, p);
  }
  const push = [...byId.values()];
  let lo = -1, hi = -1;
  if (push.length) {
    const st = [
      DB.prepare('INSERT OR IGNORE INTO counter (id, rev) VALUES (1, 0)'),
      DB.prepare('SELECT rev FROM counter WHERE id = 1'),
      DB.prepare('UPDATE counter SET rev = rev + ? WHERE id = 1').bind(push.length),
    ];
    for (let i = 0; i < push.length; i += ROWS) {
      const ch = push.slice(i, i + ROWS), args = [];
      ch.forEach((p, j) => args.push(p.id, p.m, p.d, push.length - 1 - (i + j)));
      st.push(DB.prepare('INSERT INTO notes (id, m, d, rev) VALUES ' +
        ch.map(() => '(?, ?, ?, (SELECT rev FROM counter WHERE id = 1) - ?)').join(', ') +
        ' ON CONFLICT(id) DO UPDATE SET m = excluded.m, d = excluded.d, rev = excluded.rev WHERE excluded.m > notes.m').bind(...args));
    }
    const r = await DB.batch(st);
    lo = r[1].results[0].rev; hi = lo + push.length;
  }
  const c = await DB.prepare('SELECT rev FROM counter WHERE id = 1').all();
  const top = c.results[0] ? c.results[0].rev : 0;
  let since = since0, reset = false;
  if (since > top) { since = 0; reset = true; }
  const pr = await DB.batch([
    DB.prepare('SELECT id, m, d, rev FROM notes WHERE rev > ? AND (rev <= ? OR rev > ?) ORDER BY rev ASC LIMIT ?').bind(since, lo, hi, PULL + 1),
    DB.prepare('SELECT rev FROM counter WHERE id = 1'),
  ]);
  let rows = pr[0].results;
  const more = rows.length > PULL;
  if (more) rows = rows.slice(0, PULL);
  const now = pr[1].results[0] ? pr[1].results[0].rev : 0;
  return { rev: more ? rows[rows.length - 1].rev : now, more, reset, notes: rows };
}

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const p = new URL(req.url).pathname;
    try {
      if (p === '/api/ping') return J({ ok: true, app: 'defter-sync' }, 200, cors);
      if (!(await authed(req, env))) return J({ error: 'yetkisiz' }, 401, cors);
      if (p === '/api/info' && req.method === 'GET') return J(await info(env.DB), 200, cors);
      if (p === '/api/init' && req.method === 'POST') {
        const b = await body(req);
        if (typeof b.salt !== 'string' || b.salt.length < 8 || b.salt.length > 64 || typeof b.check !== 'string' || b.check.length < 20 || b.check.length > 400) throw new Bad('geçersiz');
        await env.DB.batch([
          env.DB.prepare("INSERT OR IGNORE INTO cfg (k, v) VALUES ('salt', ?)").bind(b.salt),
          env.DB.prepare("INSERT OR IGNORE INTO cfg (k, v) VALUES ('check', ?)").bind(b.check),
        ]);
        return J(await info(env.DB), 200, cors);
      }
      if (p === '/api/sync' && req.method === 'POST') return J(await sync(env.DB, await body(req)), 200, cors);
      return J({ error: 'bulunamadı' }, 404, cors);
    } catch (e) {
      if (e instanceof Bad) return J({ error: e.message }, 400, cors);
      return J({ error: 'sunucu hatası' }, 500, cors);
    }
  },
};
