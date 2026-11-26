import { Engine } from './engine.js';
import { TARGETS, GROUPS, byId, kindOf, targetAllowed, missingEncoders, plan, computeTargetSize } from './formats.js';
import { makeZip } from './zip.js';

const $ = (s, r = document) => r.querySelector(s);
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
  : n < 1073741824 ? (n / 1048576).toFixed(1) + ' MB'
  : (n / 1073741824).toFixed(2) + ' GB';
const fmtDur = ms => ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} sn`;
const KIND_TR = { image: 'Resim', video: 'Video', animated: 'Hareketli resim', audio: 'Ses', unknown: 'Bilinmiyor' };
const isHeicFile = f => /\.(heic|heif)$/i.test(f?.name || '') || /^image\/(heic|heif)/i.test(f?.type || '');

const PRESETS = {
  archive: { target: 'png', fallbackVideo: 'mkv-ffv1', effort: 'small', verify: true },
  'web-lossless': { target: 'webp', fallbackVideo: 'mp4-h264', effort: 'balanced', verify: true },
  frames: { target: 'frames-png', effort: 'balanced', verify: true },
  anim: { target: 'apng', effort: 'balanced', verify: true },
};

// Nadir kullanılan biçimler varsayılan olarak “Gelişmiş biçimler” altında gizlenir.
const ADVANCED = new Set(['jp2', 'qoi', 'pam', 'tga', 'avi-ffv1', 'mov-h264', 'mkv-h264', 'frames-tiff']);

const state = {
  showAdvanced: false, autoRun: false,
  engine: new Engine(), ready: false, engineStatus: 'Motor hazırlanıyor…', engineError: null, items: [], nextId: 1, targetId: 'png',
  activePreset: 'archive', effort: 'small', verify: true, running: false, cancelled: false,
  chain: Promise.resolve(), current: null,
  // RESİM kategorisi içi araçlar (Boyutlandırma ve Yüz / Plaka Gizleme)
  imageTools: {
    resize: { enabled: false, mode: 'px', width: 1920, height: 0, percent: 50, keepAspect: true, noUpscale: true },
    redact: { enabled: false, style: 'pixelate', strength: 18, autoFaces: true },
  },
};
$('#effort').value = state.effort;
$('#verify').checked = state.verify;
window.__app = state;

function setEngine(text, cls) {
  state.engineStatus = text;
  state.engineError = cls === 'err' ? text : null;
  const footerInfo = $('#footerEngineInfo');
  if (footerInfo && cls === 'ok' && state.engine.caps?.versionText) {
    footerInfo.textContent = `FFmpeg ${state.engine.caps.versionText.replace('version ', '')} · WASM`;
  }
  updateAction();
}

async function boot() {
  setEngine('Motor yükleniyor… (ilk açılışta ~32 MB)', 'busy');
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

function cacheCore() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then(r => r.active?.postMessage({ type: 'cache-core' })).catch(() => {});
}

function makeThumbUrl(file) {
  if (!file) return null;
  if (isHeicFile(file)) return null;
  if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|bmp|avif|tiff?|qoi)$/i.test(file.name)) return null;
  try { return URL.createObjectURL(file); } catch { return null; }
}

function addFiles(files) {
  if (!files || !files.length) return;
  for (const f of files) {
    state.items.push({
      id: state.nextId++, file: f, origName: f.name, origSize: f.size, thumbUrl: makeThumbUrl(f),
      status: 'queued', kind: null, info: null, error: null, result: null,
      progress: 0, phase: '', elapsedMs: 0,
      redactRegions: [], // [{ x, y, w, h }] normalize edilmiş (0..1) elle işaretli alanlar
    });
  }
  renderItems(); updateAction();
  if (state.ready) probePending();
}

let heicLibPromise = null;
function loadHeicDecoder() {
  if (window.heic2any) return Promise.resolve(window.heic2any);
  if (!heicLibPromise) {
    heicLibPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
      s.onload = () => window.heic2any ? resolve(window.heic2any) : reject(new Error('HEIC çözücü yüklenemedi'));
      s.onerror = () => { heicLibPromise = null; reject(new Error('HEIC çözücü indirilemedi')); };
      document.head.appendChild(s);
    });
  }
  return heicLibPromise;
}

async function decodeHeicToPngBlob(file) {
  try {
    const bmp = await createImageBitmap(file, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    c.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close();
    return await c.convertToBlob({ type: 'image/png' });
  } catch {}

  const heic2any = await loadHeicDecoder();
  const res = await heic2any({ blob: file, toType: 'image/png' });
  return Array.isArray(res) ? res[0] : res;
}

function probePending() {
  state.chain = state.chain.then(async () => {
    for (const it of state.items.filter(i => i.status === 'queued')) {
      it.status = 'probing'; renderItems();
      try {
        if (isHeicFile(it.file)) {
          await tryBrowserDecode(it);
          renderItems(); renderTargets(); updateAction();
          continue;
        }
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

async function tryBrowserDecode(it) {
  const heic = isHeicFile(it.file);
  if (!heic && !/^image\//.test(it.file.type) && !/\.(avif|heic|heif|jxl)$/i.test(it.file.name)) return;
  try {
    let png;
    if (heic) {
      png = await decodeHeicToPngBlob(it.file);
    } else {
      const bmp = await createImageBitmap(it.file, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      c.getContext('2d').drawImage(bmp, 0, 0);
      bmp.close();
      png = await c.convertToBlob({ type: 'image/png' });
    }
    const base = (it.origName || it.file.name).replace(/\.[^.]+$/, '');
    if (it.thumbUrl) URL.revokeObjectURL(it.thumbUrl);
    it.file = new File([png], base + '.png', { type: 'image/png' });
    it.thumbUrl = makeThumbUrl(it.file);
    it.viaBrowser = true; it.error = null; it.status = 'queued';
    const p = await state.engine.mountInput(it.id, it.file);
    it.info = await state.engine.probe(p, it.file); it.kind = kindOf(it.info);
    it.status = it.kind === 'image' ? 'ready' : 'error';
    if (it.status === 'error') it.error = 'HEIC/resim çözücüsü geçerli bir kare üretemedi.';
  } catch (err) {
    it.status = 'error';
    it.error = heic
      ? 'HEIC dosyası çözülemedi: ' + (err?.message || 'Bilinmeyen hata')
      : (it.error || 'Dosya açılamadı.') + ' Tarayıcı çözücüsü de açamadı.';
  }
  finally { await state.engine.unmountInput(it.id); }
}

function applyPreset(key) {
  const pr = PRESETS[key];
  if (!pr) return;
  state.activePreset = key;
  state.effort = pr.effort;
  state.verify = pr.verify;
  $('#effort').value = pr.effort;
  $('#verify').checked = pr.verify;
  const kinds = new Set(state.items.filter(i => i.kind && i.status !== 'error').map(i => i.kind));
  const hasVid = kinds.has('video') || kinds.has('animated');
  let chosen = pr.target;
  if (hasVid && pr.fallbackVideo && byId[chosen]?.group === 'image') chosen = pr.fallbackVideo;
  if (byId[chosen] && !byId[chosen].unstable && !(state.ready && missingEncoders(byId[chosen], state.engine.caps).length)) {
    state.targetId = chosen;
  }
  document.querySelectorAll('.preset').forEach(b => b.classList.toggle('active', b.dataset.preset === key));
  renderTargets(); renderItems(); updateAction();
}

/* ---------- RESİM Kategorisi İçi Araçlar (Boyutlandırma + Yüz/Plaka Gizleme) ---------- */
function buildImageToolsUI(isImageContext) {
  const { resize, redact } = state.imageTools;
  const wrap = el('div', { class: 'img-tools' + (isImageContext ? '' : ' is-disabled') });

  // Satır içi tetikleyici düğmeler (RESİM satırındaki biçim çiplerinin hemen altında)
  const bar = el('div', { class: 'img-tools-bar' },
    el('button', {
      type: 'button',
      class: 'tool-pill' + (resize.enabled ? ' on' : ''),
      disabled: !isImageContext,
      'aria-pressed': String(resize.enabled),
      onclick: () => {
        resize.enabled = !resize.enabled;
        renderTargets(); renderItems(); updateAction();
      },
    }, '📐 Boyutlandır', resize.enabled ? el('span', { class: 'pill-badge' }, resize.mode === 'percent' ? `%${resize.percent}` : `${resize.width || 'oto'}×${resize.height || 'oto'}`) : null),
    el('button', {
      type: 'button',
      class: 'tool-pill' + (redact.enabled ? ' on' : ''),
      disabled: !isImageContext,
      'aria-pressed': String(redact.enabled),
      onclick: () => {
        redact.enabled = !redact.enabled;
        renderTargets(); renderItems(); updateAction();
      },
    }, '🛡️ Yüz / Plaka Gizle', redact.enabled ? el('span', { class: 'pill-badge' }, redact.style === 'blur' ? 'Bulanık' : 'Mozaik') : null)
  );
  wrap.append(bar);

  if (!isImageContext) return wrap;

  // Boyutlandırma alt ayarları
  if (resize.enabled) {
    const rBox = el('div', { class: 'tool-subpanel' });
    const modeSel = el('select', {
      'aria-label': 'Boyutlandırma yöntemi',
      onchange: e => { resize.mode = e.target.value; renderTargets(); updatePanelSummary(); },
    },
      el('option', { value: 'px', selected: resize.mode === 'px' }, 'Piksel (px)'),
      el('option', { value: 'percent', selected: resize.mode === 'percent' }, 'Yüzde (%)')
    );

    if (resize.mode === 'px') {
      const wInp = el('input', {
        type: 'number', min: '1', max: '16384', placeholder: 'Genişlik', value: resize.width || '',
        'aria-label': 'Genişlik (piksel)',
        oninput: e => { resize.width = Math.max(0, parseInt(e.target.value, 10) || 0); updatePanelSummary(); },
      });
      const hInp = el('input', {
        type: 'number', min: '1', max: '16384', placeholder: 'Yükseklik', value: resize.height || '',
        'aria-label': 'Yükseklik (piksel)',
        oninput: e => { resize.height = Math.max(0, parseInt(e.target.value, 10) || 0); updatePanelSummary(); },
      });
      rBox.append(
        el('div', { class: 'tool-row' },
          el('strong', { class: 'tool-lbl' }, 'Boyut:'),
          modeSel,
          wInp,
          el('span', { class: 'tool-sep' }, '×'),
          hInp,
          el('span', { class: 'tool-unit' }, 'px (boş bırakılan otomatik)')
        ),
        el('div', { class: 'tool-row' },
          el('label', { class: 'check' },
            el('input', {
              type: 'checkbox', checked: resize.keepAspect,
              onchange: e => { resize.keepAspect = e.target.checked; },
            }),
            'Orantıyı koru'
          ),
          el('label', { class: 'check' },
            el('input', {
              type: 'checkbox', checked: resize.noUpscale,
              onchange: e => { resize.noUpscale = e.target.checked; },
            }),
            'Küçük resmi büyütme'
          )
        )
      );
    } else {
      const pInp = el('input', {
        type: 'number', min: '5', max: '400', step: '5', value: resize.percent,
        'aria-label': 'Ölçek yüzdesi',
        oninput: e => { resize.percent = Math.max(1, Math.min(400, parseInt(e.target.value, 10) || 100)); updatePanelSummary(); },
      });
      rBox.append(
        el('div', { class: 'tool-row' },
          el('strong', { class: 'tool-lbl' }, 'Ölçek:'),
          modeSel,
          pInp,
          el('span', { class: 'tool-unit' }, '%')
        )
      );
    }
    wrap.append(rBox);
  }

  // Yüz / Plaka Gizleme alt ayarları
  if (redact.enabled) {
    const hasNativeFace = typeof window.FaceDetector === 'function';
    const imageItems = state.items.filter(i => i.kind === 'image' && i.status !== 'error');
    const totalManual = imageItems.reduce((s, i) => s + (i.redactRegions?.length || 0), 0);

    const styleSel = el('select', {
      'aria-label': 'Gizleme stili',
      onchange: e => { redact.style = e.target.value; renderTargets(); updatePanelSummary(); },
    },
      el('option', { value: 'pixelate', selected: redact.style === 'pixelate' }, 'Mozaik (Piksel)'),
      el('option', { value: 'blur', selected: redact.style === 'blur' }, 'Bulanıklaştır (Blur)')
    );

    const strInp = el('input', {
      type: 'range', min: '8', max: '40', value: String(redact.strength),
      'aria-label': 'Gizleme yoğunluğu',
      oninput: e => { redact.strength = Number(e.target.value); },
    });

    const mBox = el('div', { class: 'tool-subpanel' },
      el('div', { class: 'tool-row' },
        el('strong', { class: 'tool-lbl' }, 'Gizleme:'),
        styleSel,
        el('label', { class: 'tool-range' }, 'Yoğunluk', strInp)
      ),
      el('div', { class: 'tool-row' },
        el('label', { class: 'check' },
          el('input', {
            type: 'checkbox',
            checked: redact.autoFaces && hasNativeFace,
            disabled: !hasNativeFace,
            onchange: e => { redact.autoFaces = e.target.checked; },
          }),
          hasNativeFace ? 'Yüzleri otomatik algıla' : 'Otomatik yüz algılama (tarayıcı desteklemiyor — elle seçin)'
        ),
        imageItems.length > 0 ? el('button', {
          type: 'button', class: 'btn small',
          onclick: () => openRedactModal(imageItems[0]),
        }, totalManual > 0 ? `Alan Seç / Düzenle (${totalManual} işaretli)` : 'Yüz / Plaka Alanı Seç') : null
      ),
      el('p', { class: 'tool-hint' }, 'Plaka veya ek yüzleri gizlemek için resim kartındaki "Alan Seç" düğmesiyle görsel üzerinde kutu çizebilirsiniz.')
    );
    wrap.append(mBox);
  }

  return wrap;
}

function renderTargets() {
  const box = $('#targets'); box.replaceChildren();
  const kinds = new Set(state.items.filter(i => i.kind && i.status !== 'error').map(i => i.kind));
  const isUsable = t => !(state.ready && missingEncoders(t, state.engine.caps).length)
    && (kinds.size === 0 || [...kinds].some(k => targetAllowed(k, t))) && !t.unstable;
  const cur = byId[state.targetId];
  if (!cur || !isUsable(cur)) {
    const first = TARGETS.find(isUsable);
    if (first) state.targetId = first.id;
  }
  const showAdv = state.showAdvanced || ADVANCED.has(state.targetId);
  const selectedTarget = byId[state.targetId];
  const isImageContext = selectedTarget?.group === 'image' && (kinds.size === 0 || kinds.has('image'));

  for (const g of Object.keys(GROUPS)) {
    const row = el('div', { class: 'tgroup', role: 'radiogroup', 'aria-label': GROUPS[g] });
    row.append(el('h3', {}, GROUPS[g]));
    const bodyCol = el('div', { class: 'tgroup-body' });
    const chips = el('div', { class: 'chips' });
    for (const t of TARGETS.filter(t => t.group === g && (showAdv || !ADVANCED.has(t.id)))) {
      const missing = state.ready ? missingEncoders(t, state.engine.caps) : [];
      const usable = kinds.size === 0 || [...kinds].some(k => targetAllowed(k, t));
      const dis = missing.length > 0 || !usable || !!t.unstable;
      const b = el('button', {
        class: 'chip' + (state.targetId === t.id ? ' on' : '') + (t.lossless ? '' : ' lossy'),
        type: 'button', role: 'radio', 'aria-checked': String(state.targetId === t.id), disabled: dis,
        title: t.unstable ? t.unstable : missing.length ? `Bu ffmpeg derlemesinde yok: ${missing.join(', ')}` : t.hint,
        onclick: () => { state.targetId = t.id; state.activePreset = null; document.querySelectorAll('.preset').forEach(x => x.classList.remove('active')); renderTargets(); renderItems(); updateAction(); },
      }, t.label, t.lossless ? null : el('span', { class: 'tag' }, 'kayıplı'));
      chips.append(b);
    }
    bodyCol.append(chips);
    // Yüz/plaka gizleme ve boyutlandırma doğrudan RESİM kategorisinin içine yerleştirilir
    if (g === 'image') {
      bodyCol.append(buildImageToolsUI(isImageContext));
    }
    row.append(bodyCol); box.append(row);
  }
  const advBtn = el('button', {
    class: 'adv-toggle', type: 'button', 'aria-expanded': String(showAdv),
    onclick: () => {
      state.showAdvanced = !showAdv;
      if (!state.showAdvanced && ADVANCED.has(state.targetId)) state.targetId = 'png';
      renderTargets(); renderItems(); updateAction();
    },
  }, showAdv ? 'Gelişmiş biçimleri gizle' : `Gelişmiş biçimler (${ADVANCED.size})`);
  advBtn.insertAdjacentHTML('beforeend', '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>');
  box.append(advBtn);
  const t = byId[state.targetId];
  const hasImgEdit = isImageContext && (state.imageTools.resize.enabled || state.imageTools.redact.enabled);
  $('#targetNote').textContent = t
    ? t.hint + (hasImgEdit ? ' · Resim düzenleme etkin (boyut/gizleme uygulanır).' : (t.lossless ? ' · Kayıpsız hedef' : ' · Bu hedef bit-bit aynı sonuç vermez.'))
    : '';
  if ((t && !t.lossless) || hasImgEdit) $('#targetNote').dataset.lossy = '1'; else delete $('#targetNote').dataset.lossy;
  renderDonut();
  updatePanelSummary();
}

const EFFORT_TR = { fast: 'Hızlı', balanced: 'Dengeli', small: 'En küçük' };
function updatePanelSummary() {
  const n = $('#panelSummary'); if (!n) return;
  const t = byId[state.targetId];
  const extras = [];
  if (t?.group === 'image') {
    if (state.imageTools.resize.enabled) extras.push('boyutlandır');
    if (state.imageTools.redact.enabled) extras.push('gizle');
  }
  n.textContent = [t ? t.label : null, ...extras, EFFORT_TR[state.effort], state.verify ? 'doğrulamalı' : 'doğrulamasız'].filter(Boolean).join(' · ');
}

const passArgs = () => (state.engine.caps.ver >= 5.1 ? ['-fps_mode', 'passthrough'] : ['-vsync', '0']);

function outName(it, t, used) {
  const rawName = it.origName || it.file.name;
  const base = rawName.replace(/\.[^.]+$/, '') || 'dosya';
  let n = `${base}.${t.ext}`;
  if (n.toLowerCase() === rawName.toLowerCase()) n = `${base}-kayipsiz.${t.ext}`;
  let i = 2; const stem = n.replace(/\.[^.]+$/, ''), ext = t.ext;
  while (used.has(n.toLowerCase())) n = `${stem}-${i++}.${ext}`;
  used.add(n.toLowerCase());
  return n;
}

function getRunSignature(t) {
  if (t.group !== 'image') return t.id;
  const { resize, redact } = state.imageTools;
  const rKey = resize.enabled ? `rs:${resize.mode}:${resize.width}x${resize.height}:${resize.percent}:${resize.keepAspect ? 1 : 0}:${resize.noUpscale ? 1 : 0}` : '';
  const mKey = redact.enabled ? `rd:${redact.style}:${redact.strength}:${redact.autoFaces ? 1 : 0}` : '';
  return [t.id, rKey, mKey].filter(Boolean).join('|');
}

async function convertAll() {
  if (state.running) return;
  const t = byId[state.targetId];
  const sig = getRunSignature(t);
  state.running = true; state.cancelled = false; updateAction();
  const used = new Set(state.items.flatMap(i => (i.results || []).map(r => r.name.toLowerCase())));
  const todo = state.items.filter(it => {
    if (!['ready', 'error-run', 'done', 'skipped'].includes(it.status) || !it.info) return false;
    const itemSig = sig + (t.group === 'image' && state.imageTools.redact.enabled ? `:reg${(it.redactRegions || []).length}` : '');
    return !it.results?.some(r => r.runSig === itemSig);
  });
  state.runTotal = todo.length; state.runDone = 0; state.runPct = 0;
  updateAction();
  for (const it of todo) {
    if (state.cancelled) break;
    if (!['ready', 'error-run', 'done', 'skipped'].includes(it.status) || !it.info) continue;
    await convertOne(it, t, used);
    state.runDone++;
  }
  const finished = !state.cancelled && state.runTotal > 0;
  state.running = false; state.current = null; state.runPct = 0; updateAction(); renderItems();
  if (finished) {
    state.justDone = true; updateDonutCenter();
    setTimeout(() => { state.justDone = false; updateDonutCenter(); }, 3000);
  }
}

function overallPct() {
  if (!state.running || !state.runTotal) return 0;
  const cur = state.current;
  let w = 0;
  if (cur && cur.status === 'running') {
    const p = Math.max(0, Math.min(1, cur.progress || 0));
    w = cur.phase === 'Doğrulanıyor' ? 0.8 + 0.2 * p : p * (state.verify ? 0.8 : 1);
  }
  const pct = Math.min(99, Math.floor(((state.runDone + w) / state.runTotal) * 100));
  state.runPct = Math.max(state.runPct || 0, pct);
  return state.runPct;
}
function itemPct(it) {
  const p = Math.max(0, Math.min(1, it.progress || 0));
  return Math.round((it.phase === 'Doğrulanıyor' ? 0.8 + 0.2 * p : p * (state.verify ? 0.8 : 1)) * 100);
}

/* ---------- Resim ön-işleme (Yüz / Plaka gizleme + Boyutlandırma) ---------- */
function applyRegionMask(ctx, x, y, w, h, style, strength) {
  const rx = Math.max(0, Math.floor(x));
  const ry = Math.max(0, Math.floor(y));
  const rw = Math.min(ctx.canvas.width - rx, Math.ceil(w));
  const rh = Math.min(ctx.canvas.height - ry, Math.ceil(h));
  if (rw <= 1 || rh <= 1) return;

  if (style === 'blur') {
    const tmp = new OffscreenCanvas(rw, rh);
    const tctx = tmp.getContext('2d');
    tctx.filter = `blur(${Math.max(4, strength)}px)`;
    tctx.drawImage(ctx.canvas, rx, ry, rw, rh, 0, 0, rw, rh);
    ctx.drawImage(tmp, rx, ry);
  } else {
    // Mozaik (pixelate)
    const block = Math.max(6, Math.round(Math.min(rw, rh) / (46 - Math.min(38, strength))));
    const sw = Math.max(1, Math.ceil(rw / block));
    const sh = Math.max(1, Math.ceil(rh / block));
    const tmp = new OffscreenCanvas(sw, sh);
    const tctx = tmp.getContext('2d');
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(ctx.canvas, rx, ry, rw, rh, 0, 0, sw, sh);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, sw, sh, rx, ry, rw, rh);
    ctx.restore();
  }
}

async function prepareImageSource(it) {
  const { resize, redact } = state.imageTools;
  const manualRegions = redact.enabled ? (it.redactRegions || []) : [];
  const wantRedact = redact.enabled && (redact.autoFaces || manualRegions.length > 0);
  const wantResize = resize.enabled;

  if (!wantRedact && !wantResize) {
    return { file: it.file, imageOps: null };
  }

  const bmp = await createImageBitmap(it.file, { colorSpaceConversion: 'none' });
  const srcW = bmp.width, srcH = bmp.height;
  const boxes = [];
  const notes = [];

  // 1. Otomatik yüz algılama (tarayıcı FaceDetector API destekliyorsa)
  if (redact.enabled && redact.autoFaces && typeof window.FaceDetector === 'function') {
    try {
      const detector = new window.FaceDetector({ fastMode: false, maxDetectedFaces: 30 });
      const faces = await detector.detect(bmp);
      for (const f of faces) {
        const b = f.boundingBox;
        // Yüz çevresine %12 güvenlik payı ekle
        const padX = b.width * 0.12, padY = b.height * 0.14;
        boxes.push({ x: b.x - padX, y: b.y - padY, w: b.width + padX * 2, h: b.height + padY * 2 });
      }
      if (faces.length) notes.push(`${faces.length} yüz otomatik gizlendi (${redact.style === 'blur' ? 'bulanıklaştırma' : 'mozaik'}).`);
    } catch {}
  }

  // 2. Kullanıcının elle seçtiği yüz / plaka alanları
  for (const r of manualRegions) {
    boxes.push({ x: r.x * srcW, y: r.y * srcH, w: r.w * srcW, h: r.h * srcH });
  }
  if (manualRegions.length) {
    notes.push(`${manualRegions.length} işaretli alan gizlendi (${redact.style === 'blur' ? 'bulanıklaştırma' : 'mozaik'}).`);
  }

  const dim = computeTargetSize(srcW, srcH, resize);
  if (dim.scaled) {
    notes.push(`Boyutlandırıldı: ${srcW}×${srcH} → ${dim.w}×${dim.h} px.`);
  }

  // Hiçbir kutu bulunamadıysa ve sadece boyutlandırma varsa FFmpeg scale filtresine bırakabiliriz
  if (boxes.length === 0 && dim.scaled) {
    bmp.close();
    return {
      file: it.file,
      imageOps: { edited: false, scale: { w: dim.w, h: dim.h }, notes },
    };
  }

  // Gizleme veya hem gizleme hem boyutlandırma varsa tuval üzerinde işleyip kayıpsız PNG olarak FFmpeg'e aktar
  const canvas = new OffscreenCanvas(srcW, srcH);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0);
  bmp.close();

  for (const b of boxes) {
    applyRegionMask(ctx, b.x, b.y, b.w, b.h, redact.style, redact.strength);
  }

  let outCanvas = canvas;
  if (dim.scaled) {
    outCanvas = new OffscreenCanvas(dim.w, dim.h);
    const octx = outCanvas.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(canvas, 0, 0, dim.w, dim.h);
  }

  const pngBlob = await outCanvas.convertToBlob({ type: 'image/png' });
  const preFile = new File([pngBlob], 'edited.png', { type: 'image/png' });
  if (redact.enabled && boxes.length === 0) {
    notes.push('Yüz/plaka gizleme etkin ancak otomatik yüz bulunamadı ve elle alan seçilmedi.');
  }
  return {
    file: preFile,
    imageOps: { edited: boxes.length > 0 || dim.scaled, scale: null, notes },
  };
}

// ffmpeg.wasm belleği yetmediğinde kullanılan tarayıcı kodlayıcısı (yalnızca JPEG / PNG / WebP resim hedefleri).
const BROWSER_ENCODERS = {
  jpg: { mime: 'image/jpeg', quality: 0.95, exact: false, label: 'JPEG (kalite %95)' },
  png: { mime: 'image/png', quality: undefined, exact: true, label: 'PNG (8 bit)' },
  webp: { mime: 'image/webp', quality: 1, exact: false, label: 'WebP (kalite %100)' },
};
async function browserEncode(it, t, used, t0, sourceFile = it.file, imageOps = null) {
  const enc = BROWSER_ENCODERS[t.id];
  const bmp = await createImageBitmap(sourceFile, { colorSpaceConversion: 'none' });
  const dim = imageOps?.scale ? imageOps.scale : { w: bmp.width, h: bmp.height };
  const c = new OffscreenCanvas(dim.w, dim.h);
  const ctx = c.getContext('2d');
  if (t.id === 'jpg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(bmp, 0, 0, dim.w, dim.h);
  bmp.close();
  const blob = await c.convertToBlob({ type: enc.mime, quality: enc.quality });
  if (!blob || blob.type !== enc.mime) throw new Error('Tarayıcı bu biçimi yazamıyor.');
  const warnings = ['ffmpeg bu dosyada belleğe/süreye yetmediği için tarayıcının kendi kodlayıcısı kullanıldı.'];
  if (t.id === 'jpg') warnings.push('Saydam alanlar beyaza çevrildi.');
  if (t.id === 'webp') warnings.push('Tarayıcı kodlayıcısı WebP’yi tam kayıpsız yazamaz; kayıplı sayılır.');
  const isEdited = !!(imageOps?.edited || imageOps?.scale);
  return {
    blob, name: outName(it, t, used), size: blob.size, srcSize: it.origSize || it.file.size,
    durationMs: performance.now() - t0, targetId: t.id, runSig: getRunSignature(t), url: null,
    plan: { exact: enc.exact && !isEdited, warnings, notes: imageOps?.notes || [], summary: `tarayıcı kodlayıcısı · ${enc.label}`, args: [] },
    verify: (enc.exact && !isEdited) ? { skipped: 'Tarayıcı kodlayıcısı kullanıldı; bit-bit doğrulama bu yolda yapılamaz.' } : null,
  };
}

async function convertOne(it, t, used) {
  const eng = state.engine;
  const t0 = performance.now();
  it.error = null; it.progress = 0; it.phase = 'Hazırlanıyor';
  if (!targetAllowed(it.kind, t)) {
    it.error = `${t.label} bu dosya türü (${KIND_TR[it.kind]}) için kullanılamaz.`;
    it.status = it.results?.length ? 'done' : 'skipped'; renderItems(); return;
  }
  it.status = 'running'; state.current = it; renderItems();
  const outFile = `/out/o_${it.id}.${t.ext === 'zip' ? 'bin' : t.ext}`;
  const frameDir = `/out/f${it.id}`;
  let inPath, ticker = null, watchdog = null, prep = { file: it.file, imageOps: null };
  it.timedOut = false;
  try {
    if (it.kind === 'image') {
      prep = await prepareImageSource(it);
    }
    inPath = await eng.mountInput(it.id, prep.file);
    const isFrames = t.group === 'frames';
    if (isFrames) await eng.ff.createDir(frameDir);
    const outPath = isFrames ? `${frameDir}/f_%06d.${t.id === 'frames-tiff' ? 'tiff' : 'png'}` : outFile;
    const p = plan(it.info, it.kind, t, { inPath, outPath, caps: eng.caps, effort: state.effort, imageOps: prep.imageOps });
    if (p.error) throw new Error(p.error);
    eng.onProgress = v => { if (v > it.progress) { it.progress = v; paintProgress(it); } };
    if (it.kind === 'image') {
      ticker = setInterval(() => { it.progress = Math.min(0.92, it.progress + (0.92 - it.progress) * 0.04); paintProgress(it); }, 600);
    }
    if (it.kind === 'image' && BROWSER_ENCODERS[t.id]) {
      watchdog = setTimeout(() => { it.timedOut = true; eng.reset().catch(() => {}); }, 120000);
    }
    it.phase = 'Dönüştürülüyor'; renderItems();
    let r = await eng.run(p.args);
    if (r.code !== 0 && p.fallbackArgs && !state.cancelled) {
      await eng.rm(outFile);
      r = await eng.run(p.fallbackArgs);
      if (r.code === 0) p.warnings.push('Altyazı akışları aktarılamadı; altyazısız yazıldı.');
    }
    if (state.cancelled) throw new Error('İptal edildi.');
    if (r.code !== 0) throw new Error('ffmpeg hata verdi: ' + (r.log.split('\n').filter(Boolean).slice(-3).join(' ') || 'kod ' + r.code));

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

    let verify = null;
    if (state.verify && p.verify && p.verify.v) {
      it.phase = 'Doğrulanıyor'; it.progress = 0; renderItems();
      verify = await runVerify(it, p, inPath, isFrames ? frameDir : outFile, t);
    } else if (p.verify?.skip) verify = { skipped: p.verify.skip };
    if (isFrames) await eng.rmDir(frameDir); else await eng.rm(outFile);

    it.elapsedMs = performance.now() - t0;
    const itemSig = getRunSignature(t) + (t.group === 'image' && state.imageTools.redact.enabled ? `:reg${(it.redactRegions || []).length}` : '');
    const resObj = {
      blob, name: outName(it, t, used), size, srcSize: it.origSize || it.file.size,
      durationMs: it.elapsedMs, targetId: t.id, runSig: itemSig, plan: p, verify, url: null,
    };
    it.result = resObj;
    it.results = [...(it.results || []).filter(r => r.runSig !== itemSig), resObj];
    it.status = 'done';
  } catch (e) {
    it.elapsedMs = performance.now() - t0;
    it.status = it.results?.length ? 'done' : 'error-run';
    it.error = state.cancelled ? 'İptal edildi.' : it.timedOut ? 'ffmpeg çok uzun sürdü ve durduruldu.' : e.fault ? 'ffmpeg çöktü (' + (e.message || 'bilinmeyen hata') + '). Motor yeniden başlatıldı.' : (e.message || String(e));
    const crashed = state.cancelled || e.fault || it.timedOut || /RuntimeError|out of bounds|unreachable|terminated|abort/i.test(it.error);
    if (crashed) { try { await eng.reset(); } catch {} }
    else { await eng.rm(outFile); await eng.rmDir(frameDir); }
    if (crashed && !state.cancelled && it.kind === 'image' && BROWSER_ENCODERS[t.id]) {
      try {
        const resObj = await browserEncode(it, t, used, t0, prep.file, prep.imageOps);
        it.result = resObj;
        it.results = [...(it.results || []).filter(r => r.runSig !== resObj.runSig), resObj];
        it.status = 'done'; it.error = null;
      } catch (e2) {
        it.error += ' Tarayıcı kodlayıcısı da çalışmadı: ' + (e2.message || e2);
      }
    }
  } finally {
    if (ticker) clearInterval(ticker);
    if (watchdog) clearTimeout(watchdog);
    eng.onProgress = null;
    try { await eng.unmountInput(it.id); } catch {}
    renderItems();
    updateAction();
  }
}

async function runVerify(it, p, inPath, outRef, t) {
  const eng = state.engine, pass = passArgs();
  const v = p.verify;
  try {
    const src = await eng.frameHashes(['-i', inPath], '0:' + v.v.index, v.v.srcPix || v.v.pix, pass, 's' + it.id);
    const outInput = v.frames ? ['-framerate', '1', '-start_number', '1', '-i', `${outRef}/f_%06d.${t.id === 'frames-tiff' ? 'tiff' : 'png'}`] : ['-i', outRef];
    const out = await eng.frameHashes(outInput, '0:v:0', v.v.outPix || v.v.pix, pass, 'o' + it.id, v.v.outVf);
    const res = {
      frames: src.length, outFrames: out.length,
      hashes: src.map(h => h.split(':')[1]), outHashes: out.map(h => h.split(':')[1]),
      ok: false, audioOk: true, audioChecked: 0,
    };
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
    if (e.fault) { try { await eng.reset(); } catch {} }
    return { error: e.message || String(e) };
  }
}

/* ---------- Elle Yüz / Plaka Seçim Modalı ---------- */
function openRedactModal(it) {
  const modal = $('#legalModal');
  const title = $('#modalTitle');
  const body = $('#modalBody');
  if (!modal || !title || !body) return;
  const imgUrl = it.thumbUrl || URL.createObjectURL(it.file);
  const displayName = it.origName || it.file.name;
  title.textContent = `Yüz / Plaka Gizleme Alanları · ${displayName}`;
  body.innerHTML = '';

  const infoP = el('p', {}, 'Gizlemek istediğiniz yüz veya araç plakasının üzerine fareyle/parmakla dikdörtgen çizin.');
  const stage = el('div', { class: 'redact-stage' });
  const img = el('img', { src: imgUrl, alt: displayName, draggable: 'false' });
  const overlay = el('div', { class: 'redact-overlay' });
  stage.append(img, overlay);

  let dragStart = null, draftBox = null;

  function renderBoxes() {
    overlay.replaceChildren();
    (it.redactRegions || []).forEach((r, idx) => {
      const box = el('div', {
        class: 'redact-box',
        style: `left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%;`,
      },
        el('button', {
          type: 'button', class: 'redact-del', 'aria-label': 'Alanı sil',
          onclick: ev => {
            ev.stopPropagation();
            it.redactRegions.splice(idx, 1);
            renderBoxes();
            renderTargets();
            renderItems();
          },
        }, '×')
      );
      overlay.append(box);
    });
    if (draftBox) {
      overlay.append(el('div', {
        class: 'redact-box draft',
        style: `left:${draftBox.x * 100}%;top:${draftBox.y * 100}%;width:${draftBox.w * 100}%;height:${draftBox.h * 100}%;`,
      }));
    }
  }

  overlay.addEventListener('pointerdown', e => {
    if (e.target !== overlay) return;
    overlay.setPointerCapture(e.pointerId);
    const rect = overlay.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    dragStart = { x, y };
    draftBox = { x, y, w: 0, h: 0 };
    renderBoxes();
  });

  overlay.addEventListener('pointermove', e => {
    if (!dragStart) return;
    const rect = overlay.getBoundingClientRect();
    const cx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const cy = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    draftBox = {
      x: Math.min(dragStart.x, cx),
      y: Math.min(dragStart.y, cy),
      w: Math.abs(cx - dragStart.x),
      h: Math.abs(cy - dragStart.y),
    };
    renderBoxes();
  });

  overlay.addEventListener('pointerup', () => {
    if (!dragStart) return;
    if (draftBox && draftBox.w > 0.01 && draftBox.h > 0.01) {
      it.redactRegions = [...(it.redactRegions || []), draftBox];
    }
    dragStart = null;
    draftBox = null;
    renderBoxes();
    renderTargets();
    renderItems();
  });

  const bar = el('div', { class: 'tool-row', style: 'margin-top:10px;' },
    el('button', {
      type: 'button', class: 'btn small ghost',
      onclick: () => {
        it.redactRegions = [];
        renderBoxes();
        renderTargets();
        renderItems();
      },
    }, 'Tüm işaretleri temizle')
  );

  renderBoxes();
  body.append(infoP, stage, bar);
  modal.showModal();
}

function openCompareModal(it, r) {
  const modal = $('#legalModal');
  const title = $('#modalTitle');
  const body = $('#modalBody');
  if (!modal || !title || !body) return;
  const beforeUrl = it.thumbUrl || URL.createObjectURL(it.file);
  const afterUrl = r.url || (r.url = URL.createObjectURL(r.blob));
  const displayName = it.origName || it.file.name;
  const displaySize = it.origSize || it.file.size;
  title.textContent = `Önce / Sonra Kıyaslama · ${displayName} → ${r.name}`;
  body.innerHTML = '';
  const stage = el('div', { class: 'compare-stage' },
    el('img', { src: beforeUrl, alt: 'Kaynak görüntü' }),
    el('div', { class: 'compare-after-wrap', style: 'clip-path: inset(0 0 0 50%);' },
      el('img', { src: afterUrl, alt: 'Dönüştürülmüş görüntü' })),
    el('div', { class: 'compare-divider', style: 'left: 50%;' }),
    el('div', { class: 'compare-knob', style: 'left: 50%;' }, '↔'));
  const slider = el('input', {
    type: 'range', min: '0', max: '100', value: '50', class: 'compare-slider',
    'aria-label': 'Karşılaştırma çizgisi',
    oninput: e => {
      const val = Number(e.target.value);
      stage.querySelector('.compare-after-wrap').style.clipPath = `inset(0 0 0 ${val}%)`;
      stage.querySelector('.compare-divider').style.left = `${val}%`;
      stage.querySelector('.compare-knob').style.left = `${val}%`;
    },
  });
  stage.addEventListener('pointermove', e => {
    if (e.buttons !== 1 && e.pointerType === 'mouse') return;
    const rect = stage.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    slider.value = String(pct);
    stage.querySelector('.compare-after-wrap').style.clipPath = `inset(0 0 0 ${pct}%)`;
    stage.querySelector('.compare-divider').style.left = `${pct}%`;
    stage.querySelector('.compare-knob').style.left = `${pct}%`;
  });
  const diffPct = displaySize > 0 ? (((r.size - displaySize) / displaySize) * 100).toFixed(1) : '0.0';
  const labels = el('div', { class: 'compare-labels' },
    el('span', {}, `SOL: Kaynak (${fmtSize(displaySize)})`),
    el('span', {}, `SAĞ: ${r.name} (${fmtSize(r.size)} · ${diffPct > 0 ? '+' + diffPct : diffPct}%)`));
  body.append(stage, slider, labels);
  modal.showModal();
}

function paintProgress(it) {
  const n = document.querySelector(`[data-id="${it.id}"] .bar > i`);
  if (n) n.style.width = (it.progress * 100).toFixed(1) + '%';
  const s = document.querySelector(`[data-id="${it.id}"] .status`);
  if (s && it.status === 'running') s.textContent = `${it.phase} · %${itemPct(it)}`;
  updateDonutCenter();
  const go = $('#go');
  if (go && state.running) go.textContent = `Dönüştürülüyor… %${overallPct()}`;
}

function strip(hashes, other) {
  const n = Math.min(hashes.length, 48);
  const box = el('div', { class: 'strip', 'aria-hidden': 'true' });
  for (let i = 0; i < n; i++) {
    const idx = n === hashes.length ? i : Math.floor(i * hashes.length / n);
    const h = hashes[idx] || '000000', hue = parseInt(h.slice(0, 3), 16) % 360, l = 42 + (parseInt(h.slice(3, 5), 16) % 24);
    const bad = other && other[idx] !== hashes[idx];
    box.append(el('b', { style: `background:hsl(${hue} 62% ${l}%)`, class: bad ? 'bad' : '' }));
  }
  return box;
}

function renderResult(r) {
  const p = r.plan, v = r.verify, box = el('div', { class: 'result' });
  let verdict;
  if (!p.exact) verdict = el('p', { class: 'verdict lossy' }, 'Düzenlenmiş / kayıplı dönüşüm. Orijinalle bit-bit aynı değildir.');
  else if (v?.error) verdict = el('p', { class: 'verdict warn' }, 'Doğrulama yapılamadı: ' + v.error);
  else if (v?.skipped) verdict = el('p', { class: 'verdict warn' }, 'Kayıpsız hedef, ama doğrulanamadı. ' + v.skipped);
  else if (v) {
    const all = v.ok && v.audioOk;
    verdict = el('p', { class: 'verdict ' + (all ? 'ok' : 'bad') },
      all ? `✓ Bit-bit doğrulandı: ${v.frames} kare birebir aynı${v.audioChecked ? ', ses akışı da aynı' : ''}.`
        : `✕ Fark bulundu: kaynak ${v.frames} kare, çıktı ${v.outFrames} kare${v.ok ? '' : ', kare özetleri farklı'}${v.audioOk ? '' : ', ses farklı'}.`);
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

  const allRes = state.items.flatMap(i => i.results || []);
  const batchBar = $('#batchBar');
  if (allRes.length > 0) {
    const inSum = allRes.reduce((s, r) => s + r.srcSize, 0);
    const outSum = allRes.reduce((s, r) => s + r.size, 0);
    const delta = inSum > 0 ? ((outSum - inSum) / inSum) * 100 : 0;
    const totalMs = allRes.reduce((s, r) => s + (r.durationMs || 0), 0);
    batchBar.hidden = false;
    batchBar.replaceChildren(
      el('span', {}, 'Tamamlanan: ', el('strong', {}, `${allRes.length} çıktı`)),
      el('span', {}, 'Kaynak: ', el('strong', {}, fmtSize(inSum))),
      el('span', {}, 'Çıktı: ', el('strong', {}, fmtSize(outSum))),
      el('span', { class: delta <= 0 ? 'gain-ok' : '' }, `Fark: ${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`),
      el('span', {}, 'Süre: ', el('strong', {}, fmtDur(totalMs)))
    );
  } else {
    batchBar.hidden = true;
  }

  for (const it of state.items) {
    const displayName = it.origName || it.file.name;
    const displaySize = it.origSize || it.file.size;
    const vStream = it.info?.streams.find(s => s.type === 'video' && !s.attached);
    const resMeta = vStream && vStream.width && vStream.height ? `${vStream.width}×${vStream.height}${vStream.pixFmt ? ' · ' + vStream.pixFmt : ''}` : null;
    const meta = [it.kind ? KIND_TR[it.kind] : null, resMeta, fmtSize(displaySize)].filter(Boolean).join(' · ');
    const statusText = {
      queued: 'Sırada', probing: 'İnceleniyor…', ready: 'Hazır', running: `${it.phase} · %${itemPct(it)}`,
      done: 'Bitti', error: 'Açılamadı', 'error-run': 'Hata', skipped: 'Atlandı',
    }[it.status];

    const thumbEl = it.thumbUrl
      ? el('img', { class: 'thumb', src: it.thumbUrl, alt: displayName, loading: 'lazy' })
      : el('div', { class: 'thumb-ph' }, (displayName.split('.').pop() || 'FILE').slice(0, 4));

    const showCardRedactBtn = it.kind === 'image' && byId[state.targetId]?.group === 'image' && state.imageTools.redact.enabled && it.status !== 'error';

    const card = el('li', { class: 'card s-' + it.status, 'data-id': it.id },
      el('div', { class: 'row' },
        thumbEl,
        el('div', { class: 'name' },
          el('strong', {}, displayName),
          el('span', { class: 'meta' }, meta + (it.viaBrowser ? ' · HEIC/tarayıcı çözücüsü' : '') + (it.elapsedMs ? ` · ${fmtDur(it.elapsedMs)}` : ''))),
        showCardRedactBtn ? el('button', {
          type: 'button', class: 'btn small',
          onclick: () => openRedactModal(it),
        }, (it.redactRegions?.length ? `Alan Seç (${it.redactRegions.length})` : 'Alan Seç')) : null,
        el('span', { class: 'status' }, statusText),
        el('button', {
          class: 'x', type: 'button', 'aria-label': displayName + ' dosyasını kaldır',
          disabled: it.status === 'running',
          onclick: () => {
            if (it.thumbUrl) URL.revokeObjectURL(it.thumbUrl);
            (it.results || []).forEach(r => r.url && URL.revokeObjectURL(r.url));
            state.items = state.items.filter(i => i !== it);
            renderItems(); renderTargets(); updateAction();
          },
        }, '×')),
      it.status === 'running' ? el('div', { class: 'bar' }, el('i', { style: `width:${(it.progress * 100).toFixed(1)}%` })) : null,
      it.status === 'running' && it.kind === 'image' && (vStream?.width * vStream?.height) > 3e6
        ? el('p', { class: 'run-hint' }, `Büyük görsel (${((vStream.width * vStream.height) / 1e6).toFixed(1)} MP): telefonda biraz sürebilir, sayfayı kapatma.`) : null,
      it.error ? el('p', { class: 'err' }, it.error) : null);

    for (const r of it.results || []) {
      const box = el('div', { class: 'res' }, renderResult(r));
      const url = r.url || (r.url = URL.createObjectURL(r.blob));
      const dlBtn = el('a', {
        class: 'btn primary small dl-btn',
        href: url,
        download: r.name,
      }, '⬇ İndir');
      const dlRow = el('div', { class: 'dl' },
        dlBtn,
        el('span', { class: 'meta' }, `${r.name} · ${fmtSize(r.size)} · ${r.plan.summary}`));
      const tObj = byId[r.targetId];
      if (it.kind === 'image' && tObj?.group === 'image' && tObj.id !== 'gif') {
        dlRow.append(el('button', {
          type: 'button', class: 'btn small',
          onclick: () => openCompareModal(it, r),
        }, 'Önce / Sonra Kıyasla'));
      }
      box.append(dlRow);
      card.append(box);
    }
    list.append(card);
  }
}

// ---- Hedef biçim halkası: biçime dokun, dosyayı bırak, ortadan dönüştür ----
function setTarget(id) {
  state.targetId = id; state.activePreset = null;
  document.querySelectorAll('.preset').forEach(x => x.classList.remove('active'));
  renderTargets(); renderItems(); updateAction();
}
function renderDonut() {
  const kinds = new Set(state.items.filter(i => i.kind && i.status !== 'error').map(i => i.kind));
  document.querySelectorAll('.donut .seg').forEach(g => {
    const t = byId[g.dataset.target];
    const missing = t && state.ready ? missingEncoders(t, state.engine.caps).length > 0 : false;
    const allowed = !t || kinds.size === 0 || [...kinds].some(k => targetAllowed(k, t));
    const dis = !t || missing || !allowed || !!t.unstable;
    g.classList.toggle('dis', dis);
    g.classList.toggle('on', state.targetId === g.dataset.target);
    g.setAttribute('aria-checked', String(state.targetId === g.dataset.target));
    g.setAttribute('aria-disabled', String(dis));
    if (t) g.setAttribute('aria-label', t.label + (t.lossless ? '' : ' (kayıplı)'));
  });
  const t = byId[state.targetId];
  const hint = $('#donutHint');
  if (hint) hint.textContent = t ? `${t.label}${t.lossless ? ' · kayıpsız' : ' · kayıplı'} — ${t.hint}` : '';
  updateDonutCenter();
}
function updateDonutCenter() {
  const go = $('#donutGo'), sub = $('#donutSub'), title = $('#donutTitle'), svg = document.querySelector('.donut'), prog = $('#donutProg');
  if (!go || !sub || !title) return;
  const t = byId[state.targetId];
  const ready = state.items.filter(i => ['ready', 'done', 'error-run'].includes(i.status) && i.info).length;
  const off = !state.ready || state.running || ready === 0;
  go.classList.toggle('dis', off);
  go.classList.toggle('ready', !off);
  go.setAttribute('aria-disabled', String(off));
  svg?.classList.toggle('is-running', !!state.running);
  if (state.running) {
    const pct = overallPct();
    title.textContent = `%${pct}`; title.classList.add('pct'); title.setAttribute('y', '158');
    sub.textContent = state.runTotal > 1 ? `${Math.min(state.runDone + 1, state.runTotal)} / ${state.runTotal} dosya` : 'dönüştürülüyor…';
    sub.setAttribute('y', '180');
    if (prog) prog.style.strokeDashoffset = String(389.6 * (1 - pct / 100));
    return;
  }
  title.classList.remove('pct'); title.setAttribute('y', '152'); sub.setAttribute('y', '174');
  if (prog) prog.style.strokeDashoffset = '389.6';
  if (state.justDone) { title.textContent = 'Bitti ✓'; sub.textContent = 'sonuçlar aşağıda'; return; }
  title.textContent = 'Dönüştür';
  sub.textContent = state.engineError ? 'motor yüklenemedi' : !state.ready ? 'motor hazırlanıyor…' : ready === 0 ? 'önce dosya ekle' : `${t ? t.label : ''} · ${ready} dosya`;
}
const donutSegs = document.querySelectorAll('.donut .seg');
donutSegs.forEach(g => {
  const pick = () => { if (!g.classList.contains('dis')) setTarget(g.dataset.target); };
  g.addEventListener('click', pick);
  g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  g.addEventListener('dragover', e => { e.preventDefault(); if (!g.classList.contains('dis')) g.classList.add('over'); });
  g.addEventListener('dragleave', () => g.classList.remove('over'));
  g.addEventListener('drop', () => {
    g.classList.remove('over');
    if (g.classList.contains('dis')) return;
    state.targetId = g.dataset.target; state.activePreset = null; state.autoRun = true;
    document.querySelectorAll('.preset').forEach(x => x.classList.remove('active'));
    setTimeout(() => { renderTargets(); renderItems(); updateAction(); }, 0);
  });
});
$('#donutGo')?.addEventListener('click', () => { if (!$('#go').disabled) convertAll(); });
$('#donutGo')?.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !$('#go').disabled) { e.preventDefault(); convertAll(); } });

function updateAction() {
  const t = byId[state.targetId];
  const ready = state.items.filter(i => ['ready', 'done', 'error-run'].includes(i.status) && i.info);
  const btn = $('#go');
  btn.disabled = !state.ready || state.running || ready.length === 0;
  if (!state.ready) {
    btn.textContent = state.engineError ? state.engineError : 'Motor hazırlanıyor…';
  } else {
    btn.textContent = state.running ? `Dönüştürülüyor… %${overallPct()}` : `${t ? t.label : ''} olarak dönüştür (${ready.length || 0})`;
  }
  $('#cancel').hidden = !state.running;
  const done = state.items.flatMap(i => i.results || []);
  $('#zipAll').hidden = done.length === 0;
  $('#zipAll').textContent = done.length > 1 ? `Hepsini ZIP indir (${done.length})` : 'ZIP olarak indir';
  $('#clear').hidden = state.items.length === 0 || state.running;
  updateDonutCenter();
  if (state.autoRun && state.ready && !state.running && state.items.length && !state.items.some(i => i.status === 'probing' || i.status === 'queued')) {
    state.autoRun = false;
    if (ready.length) convertAll();
  }
}

async function downloadAll() {
  const done = state.items.flatMap(i => i.results || []);
  if (!done.length) return;
  try {
    const zip = await makeZip(done.map(r => ({ name: r.name, data: r.blob })));
    const url = URL.createObjectURL(zip);
    const a = el('a', { href: url, download: 'kontak-studio-cikti.zip' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    alert('ZIP oluşturulamadı: ' + (e.message || e) + ' Dosyaları tek tek indirin.');
  }
}

const drop = $('#drop'), input = $('#file');
input.addEventListener('change', () => { addFiles([...input.files]); input.value = ''; });
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => addFiles([...e.dataTransfer.files]));
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => { e.preventDefault(); if (e.target !== drop && !drop.contains(e.target)) addFiles([...e.dataTransfer.files]); });
window.addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])]; if (f.length) addFiles(f); });
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'enter' && !$('#go').disabled) {
    e.preventDefault();
    convertAll();
  }
});

document.querySelectorAll('.preset').forEach(btn => {
  btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
});

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
$('#clear').addEventListener('click', () => {
  state.items.forEach(i => {
    if (i.thumbUrl) URL.revokeObjectURL(i.thumbUrl);
    (i.results || []).forEach(r => r.url && URL.revokeObjectURL(r.url));
  });
  state.items = [];
  renderItems(); renderTargets(); updateAction();
});
$('#effort').addEventListener('change', e => { state.effort = e.target.value; updatePanelSummary(); });
$('#verify').addEventListener('change', e => { state.verify = e.target.checked; updatePanelSummary(); });

(function initFolds() {
  const mq = window.matchMedia('(min-width: 700px)');
  const folds = [...document.querySelectorAll('details.fold[data-auto]')];
  const sync = () => folds.forEach(d => { if (!d.dataset.touched) d.open = mq.matches; });
  folds.forEach(d => d.querySelector('summary')?.addEventListener('click', () => { d.dataset.touched = '1'; }));
  mq.addEventListener?.('change', sync);
  sync();
})();

async function pwa() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) $('#update').hidden = false; });
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  } catch (e) { console.warn('SW kaydı başarısız', e); }
}
$('#update').addEventListener('click', () => location.reload());

document.querySelector(`.preset[data-preset="${state.activePreset}"]`)?.classList.add('active');
renderTargets(); renderItems(); updateAction(); pwa(); boot();
