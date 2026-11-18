import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('index.html import haritası ve sürümler güncel (node tools/bump-version.mjs --check)', () => {
  execFileSync(process.execPath, [join(ROOT, 'tools/bump-version.mjs'), '--check'], { stdio: 'pipe' });
});

// Kaynak kodda import edilen her yerel modül import haritasında olmalı; yoksa önbellekte eski kalabilir.
test('import edilen her yerel modül haritada kayıtlı', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const map = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1]).imports;
  const files = readdirSync(ROOT).filter(n => n.endsWith('.js') && !['sw.js', 'forge-mark.js'].includes(n)).map(n => join(ROOT, n));
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (n.endsWith('.js')) files.push(p); } };
  walk(join(ROOT, 'engines'));
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?:^|\n)\s*import\s+[^;]*?from\s+'(\.{1,2}\/[^']+)'/g)) {
      const target = '.' + resolve(dirname(f), m[1]).slice(resolve(ROOT).length).split('\\').join('/');
      assert.ok(map[target], `${f.slice(ROOT.length + 1)} → ${m[1]} import haritasında yok (${target})`);
    }
  }
});
