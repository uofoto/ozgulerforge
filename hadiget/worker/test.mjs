// Oda mantığını sahte soketlerle sınar (ağ gerekmez): node test.mjs
import assert from 'node:assert/strict';

globalThis.WebSocketRequestResponsePair = class {};
const sockets = [];
globalThis.WebSocketPair = class {
  constructor() {
    const mk = () => {
      const w = { readyState: 1, sent: [], att: null,
        send(m) { this.sent.push(JSON.parse(m)); },
        close() { this.readyState = 3; },
        serializeAttachment(a) { this.att = a; },
        deserializeAttachment() { return this.att; } };
      return w;
    };
    this[0] = mk(); this[1] = mk(); sockets.push(this[1]);
  }
};
// Node'un Response'u 101 kabul etmez; sınama için basit bir taklit.
globalThis.Response = class { constructor(b, o = {}) { this.status = o.status ?? 200; this.webSocket = o.webSocket; } };

const { default: worker, Room, ipKey } = await import('./src/index.js');

const ctx = {
  setWebSocketAutoResponse() {},
  acceptWebSocket(ws) { ctx.list.push(ws); },
  getWebSockets() { return ctx.list; },
  list: [],
};
const room = new Room(ctx);
const req = (id, name) => ({ url: `https://x/ws?id=${id}&name=${encodeURIComponent(name)}` });

// iki cihaz katılır
let r = await room.fetch(req('aaaaaa', 'Telefon'));
assert.equal(r.status, 101);
r = await room.fetch(req('bbbbbb', 'Bilgisayar'));
const [A, B] = ctx.list;
assert.deepEqual(A.sent.at(-1).peers.map((p) => p.id), ['aaaaaa', 'bbbbbb']);
assert.deepEqual(B.sent.at(-1).peers.map((p) => p.name), ['Telefon', 'Bilgisayar']);
assert.equal(A.sent[0].t, 'hello');

// sinyal iletilir, kaynağı sunucu yazar (sahte "from" işe yaramaz)
room.webSocketMessage(A, JSON.stringify({ t: 'sig', to: 'bbbbbb', from: 'zzzz', data: { k: 'offer', code: 'o.x' } }));
const got = B.sent.at(-1);
assert.equal(got.t, 'sig'); assert.equal(got.from, 'aaaaaa'); assert.equal(got.data.code, 'o.x');

// olmayan hedefe gönderince gönderen "gone" alır
room.webSocketMessage(A, JSON.stringify({ t: 'sig', to: 'yokyok', data: { k: 'offer' } }));
assert.equal(A.sent.at(-1).t, 'gone');

// bozuk / büyük ileti sessizce yok sayılır
room.webSocketMessage(A, 'bozuk{');
room.webSocketMessage(A, 'x'.repeat(20000));
room.webSocketMessage(A, JSON.stringify({ t: 'sig', to: 'bbbbbb', data: 'metin' }));

// biri kapanınca kalan kişi güncel listeyi alır
B.readyState = 2;
room.webSocketClose(B);
assert.deepEqual(A.sent.at(-1).peers.map((p) => p.id), ['aaaaaa']);

// aynı kimlikle yeniden bağlanma eskisini düşürür
await room.fetch(req('aaaaaa', 'Telefon'));
assert.equal(A.readyState, 3);

// geçersiz kimlik reddedilir
assert.equal((await room.fetch(req('a', 'x'))).status, 400);

// oda dolu
const full = new Room({ ...ctx, list: [], getWebSockets() { return this.list; }, acceptWebSocket(w) { this.list.push(w); }, setWebSocketAutoResponse() {} });
for (let i = 0; i < 20; i++) await full.fetch(req('dev' + String(i).padStart(4, '0'), 'C'));
assert.equal((await full.fetch(req('fazlalik1', 'C'))).status, 429);

// IPv6 /64 anahtarı: gizlilik adresleri aynı odaya düşer
assert.equal(ipKey('2a01:c23:1:2::abcd'), ipKey('2a01:0c23:0001:0002:1111:2222:3333:4444'));
assert.notEqual(ipKey('2a01:c23:1:3::1'), ipKey('2a01:c23:1:2::1'));
assert.equal(ipKey('85.100.1.2'), '85.100.1.2');

// --- yönlendirme: oda seçimi ve doğrulama ---
const seen = [];
const env = { ROOMS: { idFromName: (n) => n, get: (n) => ({ fetch: async () => { seen.push(n); return { status: 101 }; } }) } };
const ws = (path, h = {}) => new Request('https://w.dev' + path, { headers: { Upgrade: 'websocket', ...h } });
await worker.fetch(ws('/ws?id=abcdef', { 'CF-Connecting-IP': '85.1.2.3' }), env);
await worker.fetch(ws('/ws?id=abcdef', { 'CF-Connecting-IP': '85.1.2.3' }), env);
await worker.fetch(ws('/ws?id=abcdef', { 'CF-Connecting-IP': '85.1.2.4' }), env);
assert.equal(seen[0], seen[1], 'aynı IP aynı odaya düşer');
assert.notEqual(seen[0], seen[2], 'farklı IP farklı odaya düşer');
assert.ok(seen[0].startsWith('n:') && !seen[0].includes('85.1.2.3'), 'oda adında ham IP yok');
await worker.fetch(ws('/ws?id=abcdef&code=123456'), env);
assert.equal(seen[3], 'c:123456');
assert.equal((await worker.fetch(ws('/ws?id=abcdef&code=12ab'), env)).status, 400);
assert.equal((await worker.fetch(new Request('https://w.dev/ws'), env)).status, 426);
assert.equal((await worker.fetch(new Request('https://w.dev/baska'), env)).status, 404);
assert.equal((await worker.fetch(new Request('https://w.dev/saglik'), env)).status, 200);

console.log('Worker mantığı: tüm sınamalar geçti');
