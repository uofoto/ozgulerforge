import { Engine } from './engine.js';
import { TARGETS, GROUPS, byId, kindOf, targetAllowed, missingEncoders, plan } from './formats.js';
import { makeZip } from './zip.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};
const fmtSize = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : n < 1073741824 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1073741824).toFixed(2) + ' GB';
const KIND_TR = { image: 'Resim', video: 'Video', animated: 'Hareketli resim', audio: 'Ses', unknown: 'Bilinmiyor' };

const state = {
  engine: new Engine(), ready: false, items: [], nextId: 1, targetId: 'png',
  effort: 'balanced', verify: true, running: false, cancelled: false, chain: Promise.resolve(), current: null,
};
window.__app = state; // test ve hata ayıklama için

/* ---------- Motor ---------- */
async function boot() {
  setEngine('Motor yükleniyor… (ilk açılışta ~32 MB, sonra çevrimdışı çalışır)', 'busy');
  try {
    await state.engine.load();
    state.ready = true;
    cacheCore();
    const c = state.engine.caps;
    setEngine(`Motor hazır · ffmpeg ${c.versionText.replace('version ', '')}`, 'ok');
  } catch (e) {
    console.error(e);
    setEngine('Motor yüklenemedi: ' + (e.message || e), 'err');
    return;
  }
  renderTargets(); renderItems(); updateAction();
  state.chain = state.chain.then(() => null);
  probePending();
}
// Kurulum 32 MB'lık wasm'ı beklemesin: motor yüklendikten sonra servis çalışanından arka planda saklamasını iste.
function cacheCore() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then(r => r.active?.postMessage({ type: 'cache-core' })).catch(() => {});
}
function setEngine(text, cls) { const n = $('#engine'); n.textContent = text; n.dataset.state = cls; }

/* ---------- Dosya ekleme ---------- */
function addFiles(files) {
  for (const f of files) {
    state.items.push({ id: state.nextId++, file: f, status: 'queued', kind: null, info: null, error: null, result: null, progress: 0, phase: '' });
  }
  renderItems(); updateAction();
  if (state.ready) probePending();
}
function probePending() {
  state.chain = state.chain.then(async () => {
    for (const it of state.items.filter(i => i.status === 'queued')) {
      it.status = 'probing'; renderItems();
      try {
        const p = await state.engine.mountInput(it.id, it.file);
        it.info = await state.engine.probe(p, it.file);
        it.kind = kindOf(it.info);
        if (it.info.animatedWebp) throw new Error('Hareketli WebP girişi bu FFmpeg sürümünde okunamıyor.');
        if (it.kind === 'audio') throw new Error('Yalnızca ses içeren dosyalar kapsam dışı. Resim veya video ekleyin.');
        if (it.kind === 'unknown') throw new Error('Görüntü akışı bulunamadı.');
        it.status = 'ready';
      } catch (e) {
        it.status = 'error'; it.error = e.message || String(e);
        if (!it.kind) await tryBrowserDecode(it);
      } finally { await state.engine.unmountInput(it.id); }
      renderItems(); renderTargets(); updateAction();
    }
  });
}
// FFmpeg açamadıysa (AVIF, HEIC, JXL gibi) tarayıcının kendi çözücüsünü dene. 8 bit sRGB PNG üretir.
async function tryBrowserDecode(it) {
  if (!/^image\//.test(it.file.type) && !/\.(avif|heic|heif|jxl)$/i.test(it.file.name)) return;
  try {
    const bmp = await createImageBitmap(it.file, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    c.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close();
    const png = await c.convertToBlob({ type: 'image/png' });
    const base = it.file.name.replace(/\.[^.]+$/, '');
    it.file = new File([png], base + '.png', { type: 'image/png' });
    it.viaBrowser = true; it.error = null; it.status = 'queued';
    // Yeniden probe edilecek. İlk bağlama hâlâ duruyor; mountInput eskisini kaldırıp yenisini bağlar.
    const p = await state.engine.mountInput(it.id, it.file);
    it.info = await state.engine.probe(p, it.file); it.kind = kindOf(it.info);
    it.status = it.kind === 'image' ? 'ready' : 'error';
    if (it.status === 'error') it.error = 'Tarayıcı çözücüsü de sonuç vermedi.';
  } catch { it.status = 'error'; it.error = (it.error || 'Dosya açılamadı.') + ' Tarayıcı çözücüsü de açamadı.'; }
  finally { await state.engine.unmountInput(it.id); }
}

/* ---------- Hedef seçici ---------- */
function renderTargets() {
  const box = $('#targets'); box.replaceChildren();
  const kinds = new Set(state.items.filter(i => i.kind && i.status !== 'error').map(i => i.kind));
  const isUsable = t => !(state.ready && missingEncoders(t, state.engine.caps).length)
    && (kinds.size === 0 || [...kinds].some(k => targetAllowed(k, t))) && !t.unstable;
  const cur = byId[state.targetId];
  if (!cur || !isUsable(cur)) { // ör. yalnız video eklenmişken PNG seçili kalmasın
    const first = TARGETS.find(isUsable);
    if (first) state.targetId = first.id;
  }
  for (const g of Object.keys(GROUPS)) {
    const row = el('div', { class: 'tgroup', role: 'radiogroup', 'aria-label': GROUPS[g] });
    row.append(el('h3', {}, GROUPS[g]));
    const chips = el('div', { class: 'chips' });
    for (const t of TARGETS.filter(t => t.group === g)) {
      const missing = state.ready ? missingEncoders(t, state.engine.caps) : [];
      const usable = kinds.size === 0 || [...kinds].some(k => targetAllowed(k, t));
      const dis = missing.length > 0 || !usable || !!t.unstable;
      const b = el('button', {
        class: 'chip' + (state.targetId === t.id ? ' on' : '') + (t.lossless ? '' : ' lossy'), type: 'button', role: 'radio',
        'aria-checked': String(state.targetId === t.id), disabled: dis,
        title: t.unstable ? t.unstable : missing.length ? `Bu ffmpeg derlemesinde yok: ${missing.join(', ')}` : t.hint,
        onclick: () => { state.targetId = t.id; renderTargets(); renderItems(); updateAction(); },
      }, t.label, t.lossless ? null : el('span', { class: 'tag' }, 'kayıplı'));
      chips.append(b);
    }
    row.append(chips); box.append(row);
  }
  const t = byId[state.targetId];
  $('#targetNote').textContent = t ? t.hint + (t.lossless ? '' : ' Bu hedef bit-bit aynı sonuç vermez.') : '';
  if (t && !t.lossless) $('#targetNote').dataset.lossy = '1'; else delete $('#targetNote').dataset.lossy;
}

/* ---------- Dönüştürme ---------- */
const passArgs = () => (state.engine.caps.ver >= 5.1 ? ['-fps_mode', 'passthrough'] : ['-vsync', '0']);

function outName(it, t, used) {
  const base = it.file.name.replace(/\.[^.]+$/, '') || 'dosya';
  let n = `${base}.${t.ext}`;
  if (n.toLowerCase() === it.file.name.toLowerCase()) n = `${base}-kayipsiz.${t.ext}`;
  let i = 2; const stem = n.replace(/\.[^.]+$/, ''), ext = t.ext;
  while (used.has(n.toLowerCase())) n = `${stem}-${i++}.${ext}`;
  used.add(n.toLowerCase());
  return n;
}

async function convertAll() {
  if (state.running) return;
  const t = byId[state.targetId];
  state.running = true; state.cancelled = false; updateAction();
  const used = new Set(state.items.flatMap(i => (i.results || []).map(r => r.name.toLowerCase())));
  for (const it of state.items) {
    if (state.cancelled) break;
    if (!['ready', 'error-run', 'done', 'skipped'].includes(it.status) || !it.info) continue;
    if (it.results?.some(r => r.targetId === t.id)) continue;
    await convertOne(it, t, used);
  }
  state.running = false; state.current = null; updateAction(); renderItems();
}

async function convertOne(it, t, used) {
  const eng = state.engine;
  it.error = null; it.progress = 0; it.phase = 'Hazırlanıyor';
  if (!targetAllowed(it.kind, t)) {
    it.error = `${t.label} bu dosya türü (${KIND_TR[it.kind]}) için kullanılamaz.`;
    it.status = it.results?.length ? 'done' : 'skipped'; renderItems(); return;
  }
  it.status = 'running'; state.current = it; renderItems();
  const outFile = `/out/o_${it.id}.${t.ext === 'zip' ? 'bin' : t.ext}`;
  const frameDir = `/out/f${it.id}`;
  let inPath;
  try {
    inPath = await eng.mountInput(it.id, it.file);
    const isFrames = t.group === 'frames';
    if (isFrames) await eng.ff.createDir(frameDir);
    const outPath = isFrames ? `${frameDir}/f_%06d.${t.id === 'frames-tiff' ? 'tiff' : 'png'}` : outFile;
    const p = plan(it.info, it.kind, t, { inPath, outPath, caps: eng.caps, effort: state.effort });
    if (p.error) throw new Error(p.error);
    eng.onProgress = v => { it.progress = v; paintProgress(it); };
    it.phase = 'Dönüştürülüyor'; renderItems();
    let r = await eng.run(p.args), usedFallback = false;
    if (r.code !== 0 && p.fallbackArgs && !state.cancelled) {
      await eng.rm(outFile); usedFallback = true;
      r = await eng.run(p.fallbackArgs);
      if (r.code === 0) p.warnings.push('Altyazı akışları aktarılamadı; altyazısız yazıldı.');
    }
    if (state.cancelled) throw new Error('İptal edildi.');
    if (r.code !== 0) throw new Error('ffmpeg hata verdi: ' + (r.log.split('\n').filter(Boolean).slice(-3).join(' ') || 'kod ' + r.code));

    // Çıktıyı oku
    let blob, size;
    if (isFrames) {
      const names = (await eng.ff.listDir(frameDir)).filter(n => !n.isDir).map(n => n.name).sort();
      if (!names.length) throw new Error('Hiç kare üretilmedi.');
      const entries = [];
      for (const n of names) entries.push({ name: n, data: await eng.readOut(`${frameDir}/${n}`) });
      p.frameCount = names.length;
      blob = await makeZip(entries);
    } else {
      const data = await eng.readOut(outFile);
      blob = new Blob([data], { type: t.mime });
    }
    size = blob.size;

    // Bit-bit doğrulama
    let verify = null;
    if (state.verify && p.verify && p.verify.v) {
      it.phase = 'Doğrulanıyor'; it.progress = 0; renderItems();
      verify = await runVerify(it, p, inPath, isFrames ? frameDir : outFile, t);
    } else if (p.verify?.skip) verify = { skipped: p.verify.skip };
    if (isFrames) await eng.rmDir(frameDir); else await eng.rm(outFile);

    it.result = { blob, name: outName(it, t, used), size, targetId: t.id, plan: p, verify, url: null, usedFallback };
    it.results = [...(it.results || []).filter(r => r.targetId !== t.id), it.result];
    it.status = 'done';
  } catch (e) {
    it.status = it.results?.length ? 'done' : 'error-run';
    it.error = state.cancelled ? 'İptal edildi.' : e.fault ? 'ffmpeg çöktü (' + (e.message || 'bilinmeyen hata') + '). Motor yeniden başlatıldı.' : (e.message || String(e));
    const crashed = state.cancelled || e.fault || /RuntimeError|out of bounds|unreachable|terminated|abort/i.test(it.error);
    if (crashed) { try { await eng.reset(); } catch {} } // çökmüş çekirdeğe komut göndermek takılır; önce yeniden başlat
    else { await eng.rm(outFile); await eng.rmDir(frameDir); }
  } finally {
    eng.onProgress = null;
    try { await eng.unmountInput(it.id); } catch {}
    renderItems();
  }
}

async function runVerify(it, p, inPath, outRef, t) {
  const eng = state.engine, pass = passArgs();
  const v = p.verify;
  try {
    const src = await eng.frameHashes(['-i', inPath], '0:' + v.v.index, v.v.srcPix || v.v.pix, pass, 's' + it.id);
    const outInput = v.frames ? ['-framerate', '1', '-start_number', '1', '-i', `${outRef}/f_%06d.${t.id === 'frames-tiff' ? 'tiff' : 'png'}`] : ['-i', outRef];
    const out = await eng.frameHashes(outInput, '0:v:0', v.v.outPix || v.v.pix, pass, 'o' + it.id, v.v.outVf);
    const res = { frames: src.length, outFrames: out.length, hashes: src.map(h => h.split(':')[1]), outHashes: out.map(h => h.split(':')[1]), ok: false, audioOk: true, audioChecked: 0 };
    res.ok = src.length > 0 && src.length === out.length && src.every((h, i) => h === out[i]);
    if (!v.frames && v.audio?.length) {
      for (const a of v.audio) {
        const h1 = await eng.audioHash(['-i', inPath], '0:' + a.srcIndex, 'as' + it.id);
        const h2 = await eng.audioHash(['-i', outRef], '0:a:' + a.k, 'ao' + it.id);
        res.audioChecked++; if (h1 !== h2) res.audioOk = false;
      }
    }
    return res;
  } catch (e) {
    if (e.fault) { try { await eng.reset(); } catch {} } // çöken çekirdekle sonraki işler takılmasın
    return { error: e.message || String(e) };
  }
}

/* ---------- Arayüz ---------- */
function paintProgress(it) {
  const n = document.querySelector(`[data-id="${it.id}"] .bar > i`);
  if (n) n.style.width = (it.progress * 100).toFixed(1) + '%';
}

function strip(hashes, other) {
  const n = Math.min(hashes.length, 48);
  const box = el('div', { class: 'strip', 'aria-hidden': 'true' });
  for (let i = 0; i < n; i++) {
    const idx = n === hashes.length ? i : Math.floor(i * hashes.length / n);
    const h = hashes[idx] || '000000', hue = parseInt(h.slice(0, 3), 16) % 360, l = 38 + (parseInt(h.slice(3, 5), 16) % 30);
    const bad = other && other[idx] !== hashes[idx];
    box.append(el('b', { style: `background:hsl(${hue} 55% ${l}%)`, class: bad ? 'bad' : '' }));
  }
  return box;
}

function renderResult(r) {
  const p = r.plan, v = r.verify, box = el('div', { class: 'result' });
  let verdict;
  if (!p.exact) verdict = el('p', { class: 'verdict lossy' }, 'Kayıplı dönüşüm. Bit-bit aynı değildir.');
  else if (v?.error) verdict = el('p', { class: 'verdict warn' }, 'Doğrulama yapılamadı: ' + v.error);
  else if (v?.skipped) verdict = el('p', { class: 'verdict warn' }, 'Kayıpsız hedef, ama doğrulanamadı. ' + v.skipped);
  else if (v) {
    const all = v.ok && v.audioOk;
    verdict = el('p', { class: 'verdict ' + (all ? 'ok' : 'bad') },
      all ? `Doğrulandı: ${v.frames} kare bit-bit aynı${v.audioChecked ? ', ses de aynı' : ''}.`
        : `Fark bulundu: kaynak ${v.frames} kare, çıktı ${v.outFrames} kare${v.ok ? '' : ', kare özetleri uyuşmuyor'}${v.audioOk ? '' : ', ses uyuşmuyor'}.`);
  } else verdict = el('p', { class: 'verdict neutral' }, 'Kayıpsız hedef; doğrulama kapalı.');
  box.append(verdict);
  if (v && v.hashes) {
    box.append(el('div', { class: 'prints' },
      el('span', {}, 'Kaynak'), strip(v.hashes, v.outHashes),
      el('span', {}, 'Çıktı'), strip(v.outHashes, v.hashes)));
  }
  const msgs = [...p.warnings.map(w => el('li', { class: 'w' }, w)), ...p.notes.map(n => el('li', {}, n))];
  if (msgs.length) box.append(el('ul', { class: 'notes' }, msgs));
  return box;
}

function renderItems() {
  const list = $('#list'); list.replaceChildren();
  $('#empty').hidden = state.items.length > 0;
  for (const it of state.items) {
    const meta = [it.kind ? KIND_TR[it.kind] : null, it.info?.streams.find(s => s.type === 'video') ? (() => { const s = it.info.streams.find(s => s.type === 'video' && !s.attached); return s ? `${s.width}×${s.height} ${s.pixFmt}` : null; })() : null, fmtSize(it.file.size)].filter(Boolean).join(' · ');
    const statusText = { queued: 'Sırada', probing: 'İnceleniyor…', ready: 'Hazır', running: it.phase, done: 'Bitti', error: 'Açılamadı', 'error-run': 'Hata', skipped: 'Atlandı' }[it.status];
    const card = el('li', { class: 'card s-' + it.status, 'data-id': it.id },
      el('div', { class: 'row' },
        el('div', { class: 'name' }, el('strong', {}, it.file.name), el('span', { class: 'meta' }, meta + (it.viaBrowser ? ' · tarayıcı çözücüsüyle okundu' : ''))),
        el('span', { class: 'status' }, statusText),
        el('button', { class: 'x', type: 'button', 'aria-label': it.file.name + ' dosyasını kaldır', disabled: it.status === 'running',
          onclick: () => { (it.results || []).forEach(r => r.url && URL.revokeObjectURL(r.url)); state.items = state.items.filter(i => i !== it); renderItems(); renderTargets(); updateAction(); } }, '×')),
      it.status === 'running' ? el('div', { class: 'bar' }, el('i', { style: `width:${(it.progress * 100).toFixed(1)}%` })) : null,
      it.error ? el('p', { class: 'err' }, it.error) : null);
    for (const r of it.results || []) {
      const box = el('div', { class: 'res' }, renderResult(r));
      const url = r.url || (r.url = URL.createObjectURL(r.blob));
      box.append(el('div', { class: 'dl' },
        el('a', { class: 'btn primary', href: url, download: r.name }, 'İndir'),
        el('span', { class: 'meta' }, `${r.name} · ${fmtSize(r.size)} · ${r.plan.summary}`)));
      card.append(box);
    }
    list.append(card);
  }
}

function updateAction() {
  const t = byId[state.targetId];
  const ready = state.items.filter(i => ['ready', 'done', 'error-run'].includes(i.status) && i.info);
  const btn = $('#go');
  btn.disabled = !state.ready || state.running || ready.length === 0;
  btn.textContent = state.running ? 'Dönüştürülüyor…' : `${t ? t.label : ''} olarak dönüştür`;
  $('#cancel').hidden = !state.running;
  const done = state.items.flatMap(i => i.results || []);
  $('#zipAll').hidden = done.length < 2;
  $('#clear').hidden = state.items.length === 0 || state.running;
}

async function downloadAll() {
  const done = state.items.flatMap(i => i.results || []);
  try {
    const zip = await makeZip(done.map(r => ({ name: r.name, data: r.blob })));
    const url = URL.createObjectURL(zip);
    const a = el('a', { href: url, download: 'donusturulenler.zip' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    alert('ZIP oluşturulamadı: ' + (e.message || e) + ' Dosyaları tek tek indirin.');
  }
}

/* ---------- Olaylar ---------- */
const drop = $('#drop'), input = $('#file');
input.addEventListener('change', () => { addFiles([...input.files]); input.value = ''; });
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => addFiles([...e.dataTransfer.files]));
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => { e.preventDefault(); if (e.target !== drop && !drop.contains(e.target)) addFiles([...e.dataTransfer.files]); });
window.addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])]; if (f.length) addFiles(f); });
$('#go').addEventListener('click', convertAll);
$('#cancel').addEventListener('click', async () => {
  state.cancelled = true; $('#cancel').disabled = true;
  setEngine('İptal ediliyor, motor yeniden başlatılıyor…', 'busy');
  try {
    await state.engine.reset();
    setEngine(`Motor hazır · ffmpeg ${state.engine.caps.versionText.replace('version ', '')}`, 'ok');
  } catch (e) {
    console.error(e);
    state.ready = false;
    setEngine('Motor yeniden başlatılamadı: ' + (e.message || e) + ' Sayfayı yenile.', 'err');
  } finally { $('#cancel').disabled = false; }
});
$('#zipAll').addEventListener('click', downloadAll);
$('#clear').addEventListener('click', () => { state.items.forEach(i => (i.results || []).forEach(r => r.url && URL.revokeObjectURL(r.url))); state.items = []; renderItems(); renderTargets(); updateAction(); });
$('#effort').addEventListener('change', e => { state.effort = e.target.value; });
$('#verify').addEventListener('change', e => { state.verify = e.target.checked; });

/* ---------- PWA ---------- */
async function pwa() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    navigator.serviceWorker.addEventListener('message', e => { if (e.data?.type === 'precached') offlineBadge(); });
    reg.addEventListener('updatefound', () => { const w = reg.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) $('#update').hidden = false; }); });
    offlineBadge();
  } catch (e) { console.warn('SW kaydı başarısız', e); }
}
let badgeTimer = 0;
async function offlineBadge() {
  clearTimeout(badgeTimer);
  try {
    const n = $('#offline');
    if (state.engine.wasm?.source === 'cdn') { // wasm CDN'den geldi; çevrimdışı çalışması için dosya sunucuya konmalı
      n.dataset.state = 'wait'; n.textContent = 'Çevrimdışı değil · wasm CDN’den'; return;
    }
    const hit = await caches.match(new URL('./vendor/core/ffmpeg-core.wasm', location.href).href);
    n.dataset.state = hit ? 'ok' : 'wait';
    n.textContent = hit ? 'Çevrimdışı hazır' : 'Çevrimdışı için indiriliyor…';
    if (!hit) badgeTimer = setTimeout(offlineBadge, 3000);
  } catch {}
}
let deferred;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#install').hidden = false; });
$('#install').addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('#install').hidden = true; });
$('#update').addEventListener('click', () => location.reload());

renderTargets(); renderItems(); updateAction(); pwa(); boot();
