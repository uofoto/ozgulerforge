import test from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers.mjs';
import { storage, loadChats } from '../storage.js';
import { KEYS } from '../config.js';

test('get/set/remove temel çalışır', () => {
  installLocalStorage();
  assert.equal(storage.get('x'), null);
  assert.equal(storage.get('x', 'varsayılan'), 'varsayılan');
  assert.equal(storage.set('x', '1'), true);
  assert.equal(storage.get('x'), '1');
  assert.equal(storage.remove('x'), true);
  assert.equal(storage.get('x'), null);
});

test('depolama yoksa ya da hata veriyorsa fırlatmaz', () => {
  delete globalThis.localStorage;
  assert.equal(storage.get('x', 'v'), 'v');
  assert.equal(storage.set('x', '1'), false);
  globalThis.localStorage = { getItem() { throw new Error('kapalı'); }, setItem() { throw new Error('dolu'); }, removeItem() { throw new Error('x'); } };
  assert.equal(storage.get('x', 'v'), 'v');
  assert.equal(storage.set('x', '1'), false);
  assert.equal(storage.setJSON('x', { a: 1 }), false);
  assert.equal(storage.remove('x'), false);
});

test('getJSON bozuk veride varsayılana düşer; setJSON döngüsel veride false döner', () => {
  installLocalStorage({ ok: '{"a":1}', bad: '{bozuk', empty: '' });
  assert.deepEqual(storage.getJSON('ok', null), { a: 1 });
  assert.equal(storage.getJSON('bad', 'f'), 'f');
  assert.equal(storage.getJSON('empty', 'f'), 'f');
  assert.equal(storage.getJSON('yok', 'f'), 'f');
  const loop = {}; loop.self = loop;
  assert.equal(storage.setJSON('d', loop), false);
});

test('loadChats: sağlam veriyi döndürür', () => {
  installLocalStorage({ [KEYS.CHATS]: JSON.stringify([{ id: 1, messages: [] }]) });
  assert.deepEqual(loadChats(), [{ id: 1, messages: [] }]);
});

test('loadChats: yoksa boş liste, yedek yazılmaz', () => {
  const ls = installLocalStorage();
  assert.deepEqual(loadChats(), []);
  assert.equal(ls.getItem(KEYS.CHATS_CORRUPT), null);
});

test('loadChats: bozuk veri sessizce kaybolmaz, ham metin yedeğe kopyalanır', () => {
  const ls = installLocalStorage({ [KEYS.CHATS]: '[{"id":1,' });
  const orig = console.warn; console.warn = () => {};
  try { assert.deepEqual(loadChats(), []); } finally { console.warn = orig; }
  assert.equal(ls.getItem(KEYS.CHATS_CORRUPT), '[{"id":1,');
});

test('loadChats: dizi olmayan veri de bozuk sayılır ve yedeklenir', () => {
  const ls = installLocalStorage({ [KEYS.CHATS]: '{"a":1}' });
  const orig = console.warn; console.warn = () => {};
  try { assert.deepEqual(loadChats(), []); } finally { console.warn = orig; }
  assert.equal(ls.getItem(KEYS.CHATS_CORRUPT), '{"a":1}');
});
