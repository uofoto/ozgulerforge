// Kontak Studio · PDF Araçları: Birleştir, Böl, PDF → JPG, JPG → PDF
// Her şey tarayıcıda çalışır. pdf-lib (birleştir/böl/oluştur) ve pdf.js (sayfa → görsel)
// yalnızca ilgili araç ilk kullanıldığında yüklenir; açılış hızı etkilenmez.
import { makeZip } from './zip.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};

const fmtSize = n => n < 1024 ? n + ' B'
  : n < 1048576 ? (n / 1024).toFixed(1) + ' KB'
  : (n / 1048576).toFixed(2) + ' MB';

const VENDOR = new URL('../vendor/', import.meta.url);
const isPdf = f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const isImg = f => (f.type || '').startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(f.name);
const stemOf = n => ((n || 'belge').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '-').trim()) || 'belge';
const pad = (n, w) => String(n).padStart(w, '0');

/* ---------- Kütüphane yükleyiciler (tembel) ---------- */
let pdfLibPromise = null;
function loadPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (!pdfLibPromise) {
    pdfLibPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL('pdf-lib/pdf-lib.min.js', VENDOR).href;
      s.onload = () => window.PDFLib ? resolve(window.PDFLib) : reject(new Error('PDF motoru yüklenemedi.'));
      s.onerror = () => reject(new Error('PDF motoru yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.'));
      document.head.append(s);
    }).catch(e => { pdfLibPromise = null; throw e; });
  }
  return pdfLibPromise;
}

let pdfJsPromise = null;
function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import(new URL('pdfjs/pdf.min.mjs', VENDOR).href).then(m => {
      m.GlobalWorkerOptions.workerSrc = new URL('pdfjs/pdf.worker.min.mjs', VENDOR).href;
      return m;
    }).catch(() => {
      pdfJsPromise = null;
      throw new Error('PDF görüntüleyici yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.');
    });
  }
  return pdfJsPromise;
}
async function openWithPdfJs(buffer) {
  const pdfjs = await loadPdfJs();
  return pdfjs.getDocument({
    data: new Uint8Array(buffer),
    cMapUrl: new URL('pdfjs/cmaps/', VENDOR).href, cMapPacked: true,
    standardFontDataUrl: new URL('pdfjs/standard_fonts/', VENDOR).href,
    wasmUrl: new URL('pdfjs/wasm/', VENDOR).href,
    iccUrl: new URL('pdfjs/iccs/', VENDOR).href,
  }).promise;
}

const friendlyPdfError = e => {
  const msg = String(e?.message || e || '');
  if (e?.name === 'PasswordException' || /encrypt|password/i.test(msg)) return 'Bu PDF parola korumalı. Parolayı kaldırdıktan sonra tekrar deneyin.';
  if (/Invalid PDF|No PDF header|InvalidPDF|Failed to parse|Unexpected token/i.test(msg)) return 'Dosya geçerli bir PDF değil ya da bozuk.';
  return msg || 'Bilinmeyen hata.';
};

/* ---------- Ortak yardımcılar ---------- */
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function uniqueNames(files) {
  const used = new Set();
  return files.map(f => {
    let n = f.name, k = 2;
    const stem = n.replace(/\.[^.]+$/, ''), ext = n.includes('.') ? n.split('.').pop() : '';
    while (used.has(n.toLowerCase())) n = `${stem}-${k++}${ext ? '.' + ext : ''}`;
    used.add(n.toLowerCase());
    return { ...f, name: n };
  });
}

function setStatus(section, msg, isError = false) {
  const p = $('.pdf-status', section);
  if (!p) return;
  if (!msg) { p.hidden = true; p.textContent = ''; delete p.dataset.lossy; return; }
  p.hidden = false; p.textContent = msg;
  if (isError) p.dataset.lossy = '1'; else delete p.dataset.lossy;
}

async function withBusy(btn, label, fn) {
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = label;
  try { return await fn(txt => { btn.textContent = txt; }); }
  finally { btn.textContent = orig; btn.disabled = false; }
}

function bindDrop(section, accept, onFiles) {
  const drop = $('.pt-drop', section);
  const input = $('input[type=file]', section);
  const handle = list => {
    const all = [...(list || [])];
    const ok = all.filter(accept);
    if (all.length > ok.length) setStatus(section, `${all.length - ok.length} dosya bu araca uygun olmadığı için atlandı.`, true);
    else setStatus(section, '');
    if (ok.length) onFiles(ok);
  };
  input.addEventListener('change', () => { handle(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { e.stopPropagation(); handle(e.dataTransfer?.files); });
}

// Sonuç kutusu: tek dosya → İndir; çok dosya → ZIP indir / Tek tek indir
function makeResult(box) {
  return {
    clear() { box.hidden = true; box.replaceChildren(); },
    show(list, zipName) {
      const files = uniqueNames(list);
      const total = files.reduce((s, f) => s + f.blob.size, 0);
      box.replaceChildren();
      box.append(el('div', { class: 'pdf-result-head' },
        el('strong', {}, files.length === 1 ? 'Dosya hazır' : `${files.length} dosya hazır`),
        el('span', { class: 'meta' }, fmtSize(total))));
      if (files.length <= 8) {
        const ul = el('ul', { class: 'rs-list' });
        for (const f of files) {
          ul.append(el('li', { class: 'rs-item is-done' },
            el('div', { class: 'rs-item-info' }, el('strong', {}, f.name), el('span', { class: 'meta' }, fmtSize(f.blob.size))),
            files.length === 1 ? el('div', { class: 'rs-item-actions' },
              el('button', { type: 'button', class: 'btn primary small', onclick: () => saveBlob(f.blob, f.name) }, 'İndir')) : null));
        }
        box.append(ul);
      }
      if (files.length > 1) {
        box.append(el('div', { class: 'pt-actions' },
          el('button', {
            type: 'button', class: 'btn primary small',
            onclick: async e => {
              const b = e.currentTarget; b.disabled = true;
              try { saveBlob(await makeZip(files.map(f => ({ name: f.name, data: f.blob }))), zipName); }
              catch (err) { alert(err.message); }
              b.disabled = false;
            },
          }, 'ZIP indir'),
          el('button', {
            type: 'button', class: 'btn small',
            onclick: () => files.forEach((f, i) => setTimeout(() => saveBlob(f.blob, f.name), i * 180)),
          }, 'Tek tek indir')));
      }
      box.hidden = false;
    },
  };
}

// Sıralanabilir dosya listesi satırı (↑ ↓ ✕)
function listRow(items, i, render, infoNodes, thumb) {
  const it = items[i];
  const move = d => () => { const j = i + d; [items[i], items[j]] = [items[j], items[i]]; render(); };
  return el('li', { class: 'rs-item' + (it.err ? ' is-bad' : '') },
    thumb ? el('img', { class: 'pdf-thumb', src: thumb, alt: '' }) : null,
    el('div', { class: 'rs-item-info' }, infoNodes),
    el('div', { class: 'rs-item-actions' },
      el('button', { type: 'button', class: 'btn ghost small', 'aria-label': 'Yukarı taşı', title: 'Yukarı taşı', disabled: i === 0, onclick: move(-1) }, '↑'),
      el('button', { type: 'button', class: 'btn ghost small', 'aria-label': 'Aşağı taşı', title: 'Aşağı taşı', disabled: i === items.length - 1, onclick: move(1) }, '↓'),
      el('button', { type: 'button', class: 'btn ghost small', 'aria-label': 'Listeden kaldır', title: 'Kaldır', onclick: () => { items.splice(i, 1); render(); } }, '✕')));
}

/* ---------- Sayfa aralığı seçici ---------- */
function parseRanges(text, max) {
  const out = new Set();
  const t = text.trim().replace(/\s*[-–]\s*/g, '-');
  if (!t) return { pages: out };
  for (const part of t.split(/[,;\s]+/).filter(Boolean)) {
    let m, a, b;
    if ((m = /^(\d+)$/.exec(part))) { a = b = +m[1]; }
    else if ((m = /^(\d*)-(\d*)$/.exec(part)) && (m[1] || m[2])) { a = m[1] ? +m[1] : 1; b = m[2] ? +m[2] : max; }
    else return { error: `“${part}” anlaşılamadı. Örnek: 1-3, 5, 8-` };
    if (a < 1 || b < 1 || a > max || b > max) return { error: `Sayfa numaraları 1 ile ${max} arasında olmalı.` };
    if (a > b) return { error: `“${part}” ters bir aralık.` };
    for (let i = a; i <= b; i++) out.add(i);
  }
  return { pages: out };
}
function rangesToText(sorted) {
  const parts = [];
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j > i ? `${sorted[i]}-${sorted[j]}` : String(sorted[i]));
    i = j + 1;
  }
  return parts.join(', ');
}

function initPicker(root, onChange = () => {}) {
  const input = $('.pdf-range', root), grid = $('.pdf-pages', root), meta = $('.pdf-picker-meta', root);
  const CHIP_LIMIT = 400;
  let count = 0, invalid = '';
  const sel = new Set();

  const syncChips = () => $$('.pdf-pg', grid).forEach(b => {
    const on = sel.has(+b.dataset.p);
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
  });
  const writeText = () => { input.value = rangesToText([...sel].sort((a, b) => a - b)); };
  const updateMeta = () => {
    meta.textContent = invalid || (count ? `${count} sayfa · ${sel.size} seçili` : '');
    meta.classList.toggle('bad', !!invalid);
  };
  const renderGrid = () => {
    grid.replaceChildren();
    if (!count) return;
    if (count > CHIP_LIMIT) { grid.append(el('span', { class: 'meta' }, 'Çok sayfalı belge: sayfaları yukarıdaki alana yazarak seçin.')); return; }
    for (let p = 1; p <= count; p++) grid.append(el('button', { type: 'button', class: 'pdf-pg', 'data-p': p, 'aria-pressed': 'false' }, String(p)));
  };
  const setSel = pages => { sel.clear(); pages.forEach(p => sel.add(p)); writeText(); syncChips(); invalid = ''; input.removeAttribute('aria-invalid'); updateMeta(); onChange(); };

  input.addEventListener('input', () => {
    const r = parseRanges(input.value, count);
    if (r.error) { invalid = r.error; input.setAttribute('aria-invalid', 'true'); }
    else { invalid = ''; input.removeAttribute('aria-invalid'); sel.clear(); r.pages.forEach(p => sel.add(p)); syncChips(); }
    updateMeta(); onChange();
  });
  grid.addEventListener('click', e => {
    const b = e.target.closest('.pdf-pg'); if (!b) return;
    const p = +b.dataset.p;
    if (sel.has(p)) sel.delete(p); else sel.add(p);
    setSel(sel);
  });
  $$('[data-pick]', root).forEach(b => b.addEventListener('click', () => {
    if (!count) return;
    setSel(b.dataset.pick === 'all' ? Array.from({ length: count }, (_, i) => i + 1) : []);
  }));

  return {
    setCount(n) { count = n; sel.clear(); input.value = ''; invalid = ''; input.removeAttribute('aria-invalid'); renderGrid(); updateMeta(); },
    pages: () => [...sel].sort((a, b) => a - b),
    error: () => invalid,
  };
}

/* ==========================================================================
   1. PDF BİRLEŞTİR
   ========================================================================== */
function initMerge(section) {
  const items = [];
  let nextId = 1;
  const list = $('.pdf-list', section);
  const runBtn = $('[data-act=run]', section), clearBtn = $('[data-act=clear]', section);
  const result = makeResult($('.pdf-result', section));

  const render = () => {
    list.replaceChildren(...items.map((it, i) => listRow(items, i, render, [
      el('strong', {}, it.file.name),
      el('span', { class: 'meta' }, it.err ? it.err : it.pages ? `${it.pages} sayfa · ${fmtSize(it.file.size)}` : `${fmtSize(it.file.size)} · okunuyor…`),
    ])));
    const ok = items.filter(i => i.pages && !i.err);
    runBtn.disabled = ok.length < 2;
    clearBtn.disabled = !items.length;
    result.clear();
  };

  bindDrop(section, isPdf, async files => {
    const added = files.map(file => ({ id: nextId++, file, pages: 0, err: '' }));
    items.push(...added); render();
    try {
      const { PDFDocument } = await loadPdfLib();
      for (const it of added) {
        try {
          const doc = await PDFDocument.load(await it.file.arrayBuffer(), { updateMetadata: false });
          it.pages = doc.getPageCount();
        } catch (e) { it.err = friendlyPdfError(e); }
        render();
      }
    } catch (e) { setStatus(section, e.message, true); }
  });

  clearBtn.addEventListener('click', () => { items.length = 0; setStatus(section, ''); render(); });

  runBtn.addEventListener('click', async () => {
    const ok = items.filter(i => i.pages && !i.err);
    if (ok.length < 2) return;
    setStatus(section, ''); result.clear();
    try {
      await withBusy(runBtn, 'Birleştiriliyor…', async setLabel => {
        const { PDFDocument } = await loadPdfLib();
        const out = await PDFDocument.create();
        for (let i = 0; i < ok.length; i++) {
          setLabel(`Birleştiriliyor… ${i + 1}/${ok.length}`);
          const src = await PDFDocument.load(await ok[i].file.arrayBuffer(), { updateMetadata: false });
          const pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach(p => out.addPage(p));
        }
        out.setProducer('Kontak Studio'); out.setCreator('Kontak Studio');
        const bytes = await out.save();
        result.show([{ name: 'birlestirilmis.pdf', blob: new Blob([bytes], { type: 'application/pdf' }) }], 'kontak-pdf.zip');
      });
    } catch (e) { setStatus(section, 'Birleştirme başarısız: ' + friendlyPdfError(e), true); }
  });
}

/* ==========================================================================
   2. PDF BÖL (Seç · Ayır · Sil)
   ========================================================================== */
function initSplit(section) {
  const state = { file: null, bytes: null, count: 0, mode: 'select' };
  const opts = $('.pdf-opts', section), info = $('.pdf-fileinfo', section);
  const runBtn = $('[data-act=run]', section), clearBtn = $('[data-act=clear]', section);
  const result = makeResult($('.pdf-result', section));
  const LABELS = { select: 'Seçilenleri PDF yap', separate: 'Sayfaları ayır', delete: 'Seçilenleri sil' };

  const update = () => {
    const picker = pickerApi;
    const n = picker.pages().length;
    runBtn.textContent = LABELS[state.mode];
    runBtn.disabled = !state.count || !!picker.error() || (state.mode !== 'separate' && n === 0);
    clearBtn.disabled = !state.file;
  };
  const pickerApi = initPicker($('.pdf-picker', section), () => { result.clear(); update(); });

  $$('[data-split-mode]', section).forEach(b => b.addEventListener('click', () => {
    state.mode = b.dataset.splitMode;
    $$('[data-split-mode]', section).forEach(x => x.classList.toggle('active', x === b));
    result.clear(); update();
  }));

  const reset = () => {
    Object.assign(state, { file: null, bytes: null, count: 0 });
    opts.hidden = true; info.hidden = true; pickerApi.setCount(0); result.clear(); update();
  };

  bindDrop(section, isPdf, async files => {
    const file = files[0];
    setStatus(section, files.length > 1 ? 'Bu araç tek PDF ile çalışır; ilk dosya alındı.' : '');
    reset();
    try {
      const { PDFDocument } = await loadPdfLib();
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { updateMetadata: false });
      Object.assign(state, { file, bytes, count: doc.getPageCount() });
      info.textContent = `${file.name} · ${state.count} sayfa · ${fmtSize(file.size)}`;
      info.hidden = false; opts.hidden = false;
      pickerApi.setCount(state.count); update();
    } catch (e) { setStatus(section, friendlyPdfError(e), true); }
  });
  clearBtn.addEventListener('click', () => { setStatus(section, ''); reset(); });

  runBtn.addEventListener('click', async () => {
    if (!state.file) return;
    const sel = pickerApi.pages();
    setStatus(section, ''); result.clear();
    try {
      await withBusy(runBtn, 'İşleniyor…', async setLabel => {
        const { PDFDocument } = await loadPdfLib();
        const src = await PDFDocument.load(state.bytes, { updateMetadata: false });
        const stem = stemOf(state.file.name);
        const build = async idx => {
          const out = await PDFDocument.create();
          (await out.copyPages(src, idx)).forEach(p => out.addPage(p));
          out.setProducer('Kontak Studio'); out.setCreator('Kontak Studio');
          return new Blob([await out.save()], { type: 'application/pdf' });
        };
        if (state.mode === 'select') {
          result.show([{ name: `${stem}-secilen.pdf`, blob: await build(sel.map(p => p - 1)) }], `${stem}-sayfalar.zip`);
        } else if (state.mode === 'delete') {
          const drop = new Set(sel);
          const keep = Array.from({ length: state.count }, (_, i) => i).filter(i => !drop.has(i + 1));
          if (!keep.length) throw new Error('Tüm sayfaları silemezsiniz. En az bir sayfa kalmalı.');
          result.show([{ name: `${stem}-duzenlenmis.pdf`, blob: await build(keep) }], `${stem}-sayfalar.zip`);
        } else {
          const targets = sel.length ? sel : Array.from({ length: state.count }, (_, i) => i + 1);
          const w = String(state.count).length, files = [];
          for (let i = 0; i < targets.length; i++) {
            setLabel(`Ayrılıyor… ${i + 1}/${targets.length}`);
            files.push({ name: `${stem}-sayfa-${pad(targets[i], w)}.pdf`, blob: await build([targets[i] - 1]) });
          }
          result.show(files, `${stem}-sayfalar.zip`);
        }
      });
    } catch (e) { setStatus(section, 'İşlem başarısız: ' + friendlyPdfError(e), true); }
    update();
  });
  update();
}

/* ==========================================================================
   3. PDF → JPG
   ========================================================================== */
function initToJpg(section) {
  const state = { file: null, doc: null, count: 0 };
  const opts = $('.pdf-opts', section), info = $('.pdf-fileinfo', section);
  const runBtn = $('[data-act=run]', section), clearBtn = $('[data-act=clear]', section);
  const dpiSel = $('[data-opt=dpi]', section), qSel = $('[data-opt=quality]', section);
  const result = makeResult($('.pdf-result', section));
  const MAX_PIXELS = 16_000_000; // iOS Safari tuval sınırı ≈ 16,7 MP

  const update = () => {
    runBtn.disabled = !state.count || !!pickerApi.error();
    clearBtn.disabled = !state.file;
  };
  const pickerApi = initPicker($('.pdf-picker', section), () => { result.clear(); update(); });

  const reset = () => {
    try { state.doc?.destroy(); } catch {}
    Object.assign(state, { file: null, doc: null, count: 0 });
    opts.hidden = true; info.hidden = true; pickerApi.setCount(0); result.clear(); update();
  };

  bindDrop(section, isPdf, async files => {
    const file = files[0];
    setStatus(section, files.length > 1 ? 'Bu araç tek PDF ile çalışır; ilk dosya alındı.' : '');
    reset();
    info.textContent = `${file.name} · okunuyor…`; info.hidden = false;
    try {
      const doc = await openWithPdfJs(await file.arrayBuffer());
      Object.assign(state, { file, doc, count: doc.numPages });
      info.textContent = `${file.name} · ${state.count} sayfa · ${fmtSize(file.size)}`;
      opts.hidden = false; pickerApi.setCount(state.count); update();
    } catch (e) { info.hidden = true; setStatus(section, friendlyPdfError(e), true); }
  });
  clearBtn.addEventListener('click', () => { setStatus(section, ''); reset(); });

  runBtn.addEventListener('click', async () => {
    if (!state.doc) return;
    const sel = pickerApi.pages();
    const targets = sel.length ? sel : Array.from({ length: state.count }, (_, i) => i + 1);
    const dpi = Number(dpiSel.value) || 150, quality = (Number(qSel.value) || 90) / 100;
    const stem = stemOf(state.file.name), w = String(state.count).length;
    setStatus(section, ''); result.clear();
    try {
      await withBusy(runBtn, 'Çevriliyor… %0', async setLabel => {
        const files = [];
        let shrunk = false;
        for (let k = 0; k < targets.length; k++) {
          setLabel(`Çevriliyor… %${Math.round((k / targets.length) * 100)}`);
          const page = await state.doc.getPage(targets[k]);
          let scale = dpi / 72, vp = page.getViewport({ scale });
          if (vp.width * vp.height > MAX_PIXELS) {
            scale *= Math.sqrt(MAX_PIXELS / (vp.width * vp.height)); vp = page.getViewport({ scale }); shrunk = true;
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.floor(vp.width)); canvas.height = Math.max(1, Math.floor(vp.height));
          const ctx = canvas.getContext('2d', { alpha: false });
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
          const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
          canvas.width = canvas.height = 0;
          page.cleanup();
          if (!blob) throw new Error('Görsel üretilemedi (bellek yetersiz olabilir). Çözünürlüğü düşürüp tekrar deneyin.');
          files.push({ name: `${stem}-sayfa-${pad(targets[k], w)}.jpg`, blob });
        }
        result.show(files, `${stem}-jpg.zip`);
        if (shrunk) setStatus(section, 'Çok büyük sayfalar tarayıcı sınırı nedeniyle seçilen çözünürlükten biraz küçük üretildi.');
      });
    } catch (e) { setStatus(section, 'Çevirme başarısız: ' + friendlyPdfError(e), true); }
    update();
  });
  update();
}

/* ==========================================================================
   4. JPG → PDF
   ========================================================================== */
function jpegInfo(u8) {
  if (u8[0] !== 0xFF || u8[1] !== 0xD8) return null;
  let i = 2, orient = 1, comps = 3;
  const u16 = p => (u8[p] << 8) | u8[p + 1];
  while (i + 4 < u8.length) {
    if (u8[i] !== 0xFF) { i++; continue; }
    const m = u8[i + 1];
    if (m === 0xFF) { i++; continue; }
    if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
    const len = u16(i + 2);
    if (m === 0xE1 && u8[i + 4] === 0x45 && u8[i + 5] === 0x78 && u8[i + 6] === 0x69 && u8[i + 7] === 0x66) {
      const t = i + 10, le = u8[t] === 0x49;
      const r16 = p => le ? u8[p] | (u8[p + 1] << 8) : (u8[p] << 8) | u8[p + 1];
      const r32 = p => le ? (u8[p] | (u8[p + 1] << 8) | (u8[p + 2] << 16) | (u8[p + 3] << 24)) >>> 0 : ((u8[p] << 24) | (u8[p + 1] << 16) | (u8[p + 2] << 8) | u8[p + 3]) >>> 0;
      const ifd = t + r32(t + 4);
      if (ifd + 2 < u8.length) {
        const n = r16(ifd);
        for (let k = 0; k < n; k++) {
          const e = ifd + 2 + k * 12;
          if (e + 12 > u8.length) break;
          if (r16(e) === 0x0112) { orient = r16(e + 8) || 1; break; }
        }
      }
    }
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
      return { h: u16(i + 5), w: u16(i + 7), comps: u8[i + 9] || comps, orient };
    }
    i += 2 + len;
  }
  return null;
}

const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792] };
const MARGINS = { none: 0, small: 10 * 72 / 25.4, normal: 20 * 72 / 25.4 };

async function decodeToCanvasImage(file) {
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width; canvas.height = bmp.height;
  canvas.getContext('2d').drawImage(bmp, 0, 0);
  bmp.close?.();
  return canvas;
}

// Görseli PDF'e gömer. Dönüş: { img, dw, dh, rot } (dw/dh: görüntülenen boyut, rot: saat yönünde derece)
async function embedImage(pdf, file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isJpg = bytes[0] === 0xFF && bytes[1] === 0xD8;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;

  if (isJpg) {
    const info = jpegInfo(bytes);
    const ROT = { 1: 0, 3: 180, 6: 90, 8: 270 };
    if (info && info.comps !== 4 && ROT[info.orient] !== undefined) {
      try {
        const img = await pdf.embedJpg(bytes); // yeniden sıkıştırma yok: JPEG olduğu gibi gömülür
        const rot = ROT[info.orient], swap = rot === 90 || rot === 270;
        return { img, dw: swap ? info.h : info.w, dh: swap ? info.w : info.h, rot };
      } catch { /* tuval yoluna düş */ }
    }
  } else if (isPng) {
    try {
      const img = await pdf.embedPng(bytes);
      return { img, dw: img.width, dh: img.height, rot: 0 };
    } catch { /* tuval yoluna düş */ }
  }

  // WebP, HEIC, AVIF, BMP, GIF, CMYK/aynalı JPEG vb.: tarayıcı çözücüsü ile
  const canvas = await decodeToCanvasImage(file);
  const big = canvas.width * canvas.height > 8_000_000;
  const asJpeg = isJpg || big;
  const blob = await new Promise(r => canvas.toBlob(r, asJpeg ? 'image/jpeg' : 'image/png', 0.95));
  if (!blob) throw new Error('Görsel işlenemedi.');
  const out = new Uint8Array(await blob.arrayBuffer());
  const img = asJpeg ? await pdf.embedJpg(out) : await pdf.embedPng(out);
  return { img, dw: canvas.width, dh: canvas.height, rot: 0 };
}

function drawOriented(page, img, rot, x, y, W, H, degrees) {
  if (rot === 90) page.drawImage(img, { x, y: y + H, width: H, height: W, rotate: degrees(-90) });
  else if (rot === 270) page.drawImage(img, { x: x + W, y, width: H, height: W, rotate: degrees(90) });
  else if (rot === 180) page.drawImage(img, { x: x + W, y: y + H, width: W, height: H, rotate: degrees(180) });
  else page.drawImage(img, { x, y, width: W, height: H });
}

function initFromJpg(section) {
  const items = [];
  const list = $('.pdf-list', section);
  const runBtn = $('[data-act=run]', section), clearBtn = $('[data-act=clear]', section);
  const sizeSel = $('[data-opt=size]', section), orientSel = $('[data-opt=orient]', section), marginSel = $('[data-opt=margin]', section);
  const result = makeResult($('.pdf-result', section));

  const syncOpts = () => { const fit = sizeSel.value === 'fit'; orientSel.disabled = fit; marginSel.disabled = fit; };
  sizeSel.addEventListener('change', syncOpts); syncOpts();

  const release = it => it.thumb && URL.revokeObjectURL(it.thumb);
  const render = () => {
    list.replaceChildren(...items.map((it, i) => listRow(items, i, render, [
      el('strong', {}, `${i + 1}. ${it.file.name}`),
      el('span', { class: 'meta' }, fmtSize(it.file.size)),
    ], it.thumb)));
    runBtn.disabled = !items.length;
    clearBtn.disabled = !items.length;
    result.clear();
  };
  // Kaldırılan öğelerin küçük resim bağlantılarını serbest bırak
  const origSplice = items.splice.bind(items);
  items.splice = (...a) => { const removed = origSplice(...a); removed.forEach(release); return removed; };

  bindDrop(section, isImg, files => {
    for (const file of files) {
      let thumb = '';
      try { thumb = URL.createObjectURL(file); } catch {}
      items.push({ file, thumb });
    }
    render();
  });
  clearBtn.addEventListener('click', () => { items.splice(0, items.length); setStatus(section, ''); render(); });

  runBtn.addEventListener('click', async () => {
    if (!items.length) return;
    setStatus(section, ''); result.clear();
    try {
      await withBusy(runBtn, 'Oluşturuluyor…', async setLabel => {
        const { PDFDocument, degrees } = await loadPdfLib();
        const pdf = await PDFDocument.create();
        const failed = [];
        for (let i = 0; i < items.length; i++) {
          setLabel(`Oluşturuluyor… ${i + 1}/${items.length}`);
          let em;
          try { em = await embedImage(pdf, items[i].file); }
          catch { failed.push(items[i].file.name); continue; }
          const { img, dw, dh, rot } = em;
          let pw, ph, m = 0;
          if (sizeSel.value === 'fit') {
            const k = Math.min(0.75, 14400 / Math.max(dw, dh)); // 96 dpi eşdeğeri, PDF üst sınırı 14400 pt
            pw = dw * k; ph = dh * k;
          } else {
            [pw, ph] = PAGE_SIZES[sizeSel.value];
            const o = orientSel.value;
            if (o === 'landscape' || (o === 'auto' && dw > dh)) [pw, ph] = [ph, pw];
            m = MARGINS[marginSel.value] ?? 0;
          }
          const page = pdf.addPage([pw, ph]);
          const bw = pw - 2 * m, bh = ph - 2 * m, s = Math.min(bw / dw, bh / dh);
          const W = dw * s, H = dh * s;
          drawOriented(page, img, rot, m + (bw - W) / 2, m + (bh - H) / 2, W, H, degrees);
        }
        if (!pdf.getPageCount()) throw new Error('Hiçbir görsel PDF’e eklenemedi.');
        pdf.setProducer('Kontak Studio'); pdf.setCreator('Kontak Studio');
        const bytes = await pdf.save();
        result.show([{ name: 'gorseller.pdf', blob: new Blob([bytes], { type: 'application/pdf' }) }], 'kontak-pdf.zip');
        if (failed.length) setStatus(section, `${failed.length} görsel okunamadığı için atlandı: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}`, true);
      });
    } catch (e) { setStatus(section, 'PDF oluşturulamadı: ' + friendlyPdfError(e), true); }
  });
  render();
}

/* ==========================================================================\n   5. PDF DÜZENLE (döndürme · sayfa numarası · filigran)\n   ========================================================================== */
function initPdfEdit(section) {
  let file = null, pageCount = 0;
  const info = $('.pdf-fileinfo', section);
  const opts = $('.pdf-opts', section);
  const runBtn = $('[data-act=run]', section), clearBtn = $('[data-act=clear]', section);
  const result = makeResult($('.pdf-result', section));
  const rotation = $('[data-opt=rotation]', section);
  const numbers = $('[data-opt=pageNumbers]', section);
  const numberPosition = $('[data-opt=numberPosition]', section);
  const watermark = $('[data-opt=watermark]', section);
  const opacity = $('[data-opt=opacity]', section);

  const reset = () => {
    file = null; pageCount = 0; info.hidden = true; info.textContent = '';
    opts.hidden = true; runBtn.disabled = true; clearBtn.disabled = true;
    rotation.value = '0'; numbers.checked = false; numberPosition.value = 'bottom';
    watermark.value = ''; opacity.value = '0.22'; result.clear(); setStatus(section, '');
  };
  bindDrop(section, isPdf, async files => {
    const selected = files[0];
    if (files.length > 1) setStatus(section, 'Bu araç tek PDF ile çalışır; ilk dosya seçildi.');
    file = selected; result.clear(); setStatus(section, 'PDF inceleniyor…');
    try {
      const { PDFDocument } = await loadPdfLib();
      const doc = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
      pageCount = doc.getPageCount();
      info.hidden = false; info.textContent = `${file.name} · ${pageCount} sayfa · ${fmtSize(file.size)}`;
      opts.hidden = false; runBtn.disabled = false; clearBtn.disabled = false;
      setStatus(section, 'PDF hazır. İstediğiniz düzenlemeleri seçebilirsiniz.');
    } catch (e) {
      reset(); setStatus(section, 'PDF açılamadı: ' + friendlyPdfError(e), true);
    }
  });

  clearBtn.addEventListener('click', reset);
  runBtn.addEventListener('click', async () => {
    if (!file || !pageCount) return;
    const turn = Number(rotation.value) || 0;
    const addNumbers = numbers.checked;
    const mark = watermark.value.trim();
    if (!turn && !addNumbers && !mark) {
      setStatus(section, 'Önce en az bir düzenleme seçin veya filigran metni yazın.', true);
      return;
    }
    result.clear(); setStatus(section, '');
    try {
      await withBusy(runBtn, 'PDF düzenleniyor…', async setLabel => {
        const { PDFDocument, StandardFonts, rgb, degrees } = await loadPdfLib();
        const doc = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
        const pages = doc.getPages();
        let font = null;
        if (addNumbers || mark) font = await doc.embedFont(StandardFonts.Helvetica);
        for (let i = 0; i < pages.length; i++) {
          setLabel(`Düzenleniyor… ${i + 1}/${pages.length}`);
          const page = pages[i];
          if (turn) {
            const current = page.getRotation().angle || 0;
            page.setRotation(degrees(((current + turn) % 360 + 360) % 360));
          }
          const { width, height } = page.getSize();
          if (addNumbers) {
            const label = `${i + 1} / ${pages.length}`;
            const size = Math.max(8, Math.min(11, width / 45));
            const textWidth = font.widthOfTextAtSize(label, size);
            const y = numberPosition.value === 'top' ? height - size - 18 : 18;
            page.drawText(label, { x: Math.max(12, (width - textWidth) / 2), y, size, font, color: rgb(0.28, 0.28, 0.32) });
          }
          if (mark) {
            const size = Math.max(24, Math.min(58, width / 8));
            const textWidth = font.widthOfTextAtSize(mark, size);
            page.drawText(mark, {
              x: Math.max(12, (width - textWidth) / 2), y: height / 2,
              size, font, color: rgb(0.42, 0.42, 0.46), opacity: Number(opacity.value) || 0.22,
              rotate: degrees(-35),
            });
          }
        }
        doc.setProducer('Kontak Studio'); doc.setCreator('Kontak Studio');
        const bytes = await doc.save();
        const stem = stemOf(file.name);
        result.show([{ name: `${stem}-duzenlendi.pdf`, blob: new Blob([bytes], { type: 'application/pdf' }) }], 'kontak-duzenlenmis-pdf.zip');
        setStatus(section, `${pages.length} sayfa başarıyla düzenlendi. Orijinal dosyanız değiştirilmedi.`);
      });
    } catch (e) { setStatus(section, 'PDF düzenlenemedi: ' + friendlyPdfError(e), true); }
  });
}

/* ==========================================================================
   Giriş: kart seçimi + araçların bağlanması
   ========================================================================== */
export function initPdfTools() {
  const group = $('#pdfGroup');
  const work = $('#pdfWork');
  if (!group || !work) return;

  const tools = {
    merge: initMerge, split: initSplit, tojpg: initToJpg, fromjpg: initFromJpg, edit: initPdfEdit,
  };
  for (const [id, init] of Object.entries(tools)) {
    const section = $(`.pdf-tool[data-tool="${id}"]`, work);
    if (section) init(section);
  }

  const cards = $$('.pdf-card', group);
  const show = id => {
    cards.forEach(c => { const on = c.dataset.pdfTool === id; c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); });
    $$('.pdf-tool', work).forEach(s => { s.hidden = s.dataset.tool !== id; });
    work.hidden = !id;
  };
  cards.forEach(c => c.addEventListener('click', () => show(c.classList.contains('on') ? '' : c.dataset.pdfTool)));
}
