// Kontak Studio · Fotoğraf Hedef Boyut (Sıkıştır & Boyutlandır) ve Yüz/Plaka Gizleme Modülü
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
  : (n / 1048576).toFixed(2) + ' MB';

/* ==========================================================================
   1. HEDEF BOYUT / FOTOĞRAF BOYUTLANDIRMA & SIKIŞTIRMA
   ========================================================================== */
const resizeState = {
  presetBytes: 100 * 1024, // Varsayılan: 100 KB (ekran görüntüsüyle uyumlu)
  mode: 'preset',          // 'preset' | 'custom' | 'keep'
  customVal: 250,
  customUnit: 'KB',        // 'KB' | 'MB'
  format: 'image/jpeg',    // 'image/jpeg' | 'image/webp' | 'image/png'
  maxEdge: 0,              // 0 = Çözünürlüğü araç seçsin, aksi halde max px (2560, 1920, 1600, 1280, 1024, 800)
  simplifyName: false,
  items: [],               // { id, file, origName, origSize, w, h, status, result }
  nextId: 1,
  running: false,
};

function getTargetBytes() {
  if (resizeState.mode === 'keep') return null;
  if (resizeState.mode === 'custom') {
    const val = Math.max(1, Number(resizeState.customVal) || 100);
    return resizeState.customUnit === 'MB' ? Math.round(val * 1024 * 1024) : Math.round(val * 1024);
  }
  return resizeState.presetBytes;
}

function cleanFileName(name, ext, simplify) {
  const stem = (name || 'fotograf').replace(/\.[^.]+$/, '');
  if (!simplify) return `${stem}.${ext}`;
  const trMap = { 'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u' };
  const slug = stem
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, ch => trMap[ch] || ch)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'fotograf';
  return `${slug}.${ext}`;
}

async function decodeImageSource(file) {
  try {
    const bmp = await createImageBitmap(file);
    return { src: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = url;
      });
      return { src: img, w: img.naturalWidth, h: img.naturalHeight, close: () => {} };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function renderScaledBlob(src, w, h, mime, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d');
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(b => resolve(b), mime, quality));
}

// Kaliteyi %78'in altına düşürmeden hedef dosya boyutunu tutturan en büyük çözünürlüğü arar.
async function smartCompressImage(file) {
  const targetBytes = getTargetBytes();
  const mime = resizeState.format;
  const ext = mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
  const decoded = await decodeImageSource(file);

  try {
    let baseW = decoded.w;
    let baseH = decoded.h;
    const maxEdge = Number(resizeState.maxEdge) || 0;
    if (maxEdge > 0 && Math.max(baseW, baseH) > maxEdge) {
      const ratio = maxEdge / Math.max(baseW, baseH);
      baseW = Math.round(baseW * ratio);
      baseH = Math.round(baseH * ratio);
    }

    // "Kaliteyi koru (hedef yok)" modu
    if (!targetBytes) {
      const q = mime === 'image/png' ? undefined : 0.92;
      const blob = await renderScaledBlob(decoded.src, baseW, baseH, mime, q);
      return {
        blob,
        w: baseW,
        h: baseH,
        quality: mime === 'image/png' ? 100 : 92,
        name: cleanFileName(file.name, ext, resizeState.simplifyName),
        hitTarget: true,
      };
    }

    // PNG kalite parametresi desteklemediği için doğrudan çözünürlük ölçekleme ikili araması yapılır
    if (mime === 'image/png') {
      let blob = await renderScaledBlob(decoded.src, baseW, baseH, mime);
      if (blob.size <= targetBytes) {
        return { blob, w: baseW, h: baseH, quality: 100, name: cleanFileName(file.name, ext, resizeState.simplifyName), hitTarget: true };
      }
      let lo = 0.08, hi = 1.0, best = null;
      for (let step = 0; step < 9; step++) {
        const mid = (lo + hi) / 2;
        const w = Math.max(32, Math.round(baseW * mid));
        const h = Math.max(32, Math.round(baseH * mid));
        const b = await renderScaledBlob(decoded.src, w, h, mime);
        if (b.size <= targetBytes) {
          best = { blob: b, w, h, quality: 100 };
          lo = mid;
        } else {
          hi = mid;
        }
      }
      if (!best) {
        const w = Math.max(32, Math.round(baseW * lo));
        const h = Math.max(32, Math.round(baseH * lo));
        best = { blob: await renderScaledBlob(decoded.src, w, h, mime), w, h, quality: 100 };
      }
      return { ...best, name: cleanFileName(file.name, ext, resizeState.simplifyName), hitTarget: best.blob.size <= targetBytes };
    }

    // JPEG & WebP: Önce mevcut (veya üst sınır uygulanmış) çözünürlükte kaliteyi %94 -> %78 arasında dene
    const MIN_Q = 0.78;
    const MAX_Q = 0.94;

    const findBestQualityAtScale = async (scale) => {
      const w = Math.max(32, Math.round(baseW * scale));
      const h = Math.max(32, Math.round(baseH * scale));
      const atMin = await renderScaledBlob(decoded.src, w, h, mime, MIN_Q);
      if (atMin.size > targetBytes) return { fits: false, blob: atMin, w, h, q: MIN_Q };
      const atMax = await renderScaledBlob(decoded.src, w, h, mime, MAX_Q);
      if (atMax.size <= targetBytes) return { fits: true, blob: atMax, w, h, q: MAX_Q };

      let loQ = MIN_Q, hiQ = MAX_Q, bestQ = { fits: true, blob: atMin, w, h, q: MIN_Q };
      for (let i = 0; i < 6; i++) {
        const midQ = (loQ + hiQ) / 2;
        const b = await renderScaledBlob(decoded.src, w, h, mime, midQ);
        if (b.size <= targetBytes) {
          bestQ = { fits: true, blob: b, w, h, q: midQ };
          loQ = midQ;
        } else {
          hiQ = midQ;
        }
      }
      return bestQ;
    };

    const fullTry = await findBestQualityAtScale(1.0);
    if (fullTry.fits) {
      return {
        blob: fullTry.blob,
        w: fullTry.w,
        h: fullTry.h,
        quality: Math.round(fullTry.q * 100),
        name: cleanFileName(file.name, ext, resizeState.simplifyName),
        hitTarget: true,
      };
    }

    // Kalite %78'in altına düşmeden hedefi tutturmak için çözünürlüğü ikili arama ile küçült
    let loS = 0.08, hiS = 1.0, bestScaleRes = null;
    for (let i = 0; i < 8; i++) {
      const midS = (loS + hiS) / 2;
      const attempt = await findBestQualityAtScale(midS);
      if (attempt.fits) {
        bestScaleRes = attempt;
        loS = midS;
      } else {
        hiS = midS;
      }
    }

    if (!bestScaleRes) {
      bestScaleRes = await findBestQualityAtScale(loS);
    }

    return {
      blob: bestScaleRes.blob,
      w: bestScaleRes.w,
      h: bestScaleRes.h,
      quality: Math.round(bestScaleRes.q * 100),
      name: cleanFileName(file.name, ext, resizeState.simplifyName),
      hitTarget: bestScaleRes.blob.size <= targetBytes,
    };
  } finally {
    decoded.close();
  }
}

async function processResizeQueue() {
  if (resizeState.running || !resizeState.items.length) return;
  resizeState.running = true;
  renderResizeList();
  for (const it of resizeState.items) {
    it.status = 'running';
    renderResizeList();
    try {
      const res = await smartCompressImage(it.file);
      if (it.result?.url) URL.revokeObjectURL(it.result.url);
      res.url = URL.createObjectURL(res.blob);
      it.result = res;
      it.status = 'done';
    } catch (err) {
      it.status = 'error';
      it.error = err?.message || 'İşlenemedi';
    }
    renderResizeList();
  }
  resizeState.running = false;
  updateResizeButtons();
}

function addResizeFiles(fileList) {
  const imgs = [...(fileList || [])].filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif|avif|tiff?)$/i.test(f.name));
  if (!imgs.length) return;
  for (const f of imgs) {
    resizeState.items.push({
      id: resizeState.nextId++,
      file: f,
      origName: f.name,
      origSize: f.size,
      status: 'queued',
      result: null,
      error: null,
    });
  }
  renderResizeList();
  processResizeQueue();
}

function updateResizeButtons() {
  const doneItems = resizeState.items.filter(i => i.status === 'done' && i.result);
  const zipBtn = $('#rsZipBtn');
  const singleBtn = $('#rsSingleBtn');
  const clearBtn = $('#rsClearBtn');
  if (zipBtn) zipBtn.disabled = doneItems.length === 0 || resizeState.running;
  if (singleBtn) singleBtn.disabled = doneItems.length === 0 || resizeState.running;
  if (clearBtn) clearBtn.disabled = resizeState.items.length === 0 || resizeState.running;
}

function renderResizeList() {
  const list = $('#rsList');
  if (!list) return;
  list.replaceChildren();
  updateResizeButtons();

  for (const it of resizeState.items) {
    const r = it.result;
    const badgeText = it.status === 'running' ? 'Hesaplanıyor…'
      : it.status === 'error' ? ('Hata: ' + it.error)
      : r ? `${fmtSize(it.origSize)} → ${fmtSize(r.blob.size)} · ${r.w}×${r.h} px · Kalite %${r.quality}`
      : 'Sırada';

    const row = el('li', { class: 'rs-item' + (it.status === 'done' ? ' is-done' : '') },
      el('div', { class: 'rs-item-info' },
        el('strong', {}, r ? r.name : it.origName),
        el('span', { class: 'meta' }, badgeText)),
      el('div', { class: 'rs-item-actions' },
        r ? el('a', { class: 'btn small primary', href: r.url, download: r.name }, 'İndir') : null,
        el('button', {
          type: 'button',
          class: 'x',
          'aria-label': 'Kaldır',
          onclick: () => {
            if (it.result?.url) URL.revokeObjectURL(it.result.url);
            resizeState.items = resizeState.items.filter(x => x !== it);
            renderResizeList();
          },
        }, '×')));
    list.append(row);
  }
}

function initResizeTool() {
  const drop = $('#rsDrop');
  const fileIn = $('#rsFile');
  if (!drop || !fileIn) return;

  fileIn.addEventListener('change', () => {
    addResizeFiles(fileIn.files);
    fileIn.value = '';
  });

  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault();
    drop.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault();
    drop.classList.remove('over');
  }));
  drop.addEventListener('drop', e => {
    e.stopPropagation();
    addResizeFiles(e.dataTransfer?.files);
  });

  // Hedef boyut butonları (50 KB, 100 KB, 200 KB, 500 KB, 1 MB, Özel, Kaliteyi koru)
  const customRow = $('#rsCustomRow');
  document.querySelectorAll('[data-rs-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-rs-target]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.dataset.rsTarget;
      if (val === 'custom') {
        resizeState.mode = 'custom';
        if (customRow) customRow.hidden = false;
      } else if (val === 'keep') {
        resizeState.mode = 'keep';
        if (customRow) customRow.hidden = true;
      } else {
        resizeState.mode = 'preset';
        resizeState.presetBytes = Number(val);
        if (customRow) customRow.hidden = true;
      }
      if (resizeState.items.length) processResizeQueue();
    });
  });

  $('#rsCustomVal')?.addEventListener('input', e => {
    resizeState.customVal = Number(e.target.value) || 250;
  });
  $('#rsCustomVal')?.addEventListener('change', () => {
    if (resizeState.mode === 'custom' && resizeState.items.length) processResizeQueue();
  });
  $('#rsCustomUnit')?.addEventListener('change', e => {
    resizeState.customUnit = e.target.value;
    if (resizeState.mode === 'custom' && resizeState.items.length) processResizeQueue();
  });

  $('#rsFormat')?.addEventListener('change', e => {
    resizeState.format = e.target.value;
    if (resizeState.items.length) processResizeQueue();
  });

  $('#rsMaxEdge')?.addEventListener('change', e => {
    resizeState.maxEdge = Number(e.target.value) || 0;
    if (resizeState.items.length) processResizeQueue();
  });

  $('#rsSimplify')?.addEventListener('change', e => {
    resizeState.simplifyName = e.target.checked;
    if (resizeState.items.length) processResizeQueue();
  });

  $('#rsZipBtn')?.addEventListener('click', async () => {
    const done = resizeState.items.filter(i => i.status === 'done' && i.result);
    if (!done.length) return;
    const used = new Set();
    const entries = done.map(i => {
      let n = i.result.name;
      let k = 2;
      const stem = n.replace(/\.[^.]+$/, '');
      const ext = n.split('.').pop();
      while (used.has(n.toLowerCase())) n = `${stem}-${k++}.${ext}`;
      used.add(n.toLowerCase());
      return { name: n, data: i.result.blob };
    });
    const zipBlob = await makeZip(entries);
    const url = URL.createObjectURL(zipBlob);
    const a = el('a', { href: url, download: 'kontak-boyutlandirilmis.zip' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });

  $('#rsSingleBtn')?.addEventListener('click', () => {
    const done = resizeState.items.filter(i => i.status === 'done' && i.result);
    done.forEach((i, idx) => {
      setTimeout(() => {
        const a = el('a', { href: i.result.url, download: i.result.name });
        document.body.append(a);
        a.click();
        a.remove();
      }, idx * 180);
    });
  });

  $('#rsClearBtn')?.addEventListener('click', () => {
    resizeState.items.forEach(i => i.result?.url && URL.revokeObjectURL(i.result.url));
    resizeState.items = [];
    renderResizeList();
  });
}


/* ==========================================================================
   2. YÜZ VE PLAKA GİZLEME (BULANIKLAŞTIR / PİKSELLEŞTİR / DÜZ BLOK)
   ========================================================================== */
const redactState = {
  img: null,          // HTMLImageElement veya ImageBitmap
  fileName: '',
  origW: 0,
  origH: 0,
  method: 'pixelate', // 'blur' | 'pixelate' | 'solid' (ekran görüntüsündeki gibi varsayılan Pikselleştir)
  strength: 70,       // 10..100 (varsayılan 70)
  outFormat: 'image/jpeg',
  rects: [],          // [{ x, y, w, h, method, strength }] (orijinal görüntü koordinatlarında)
  draftRect: null,    // sürükleme sırasında geçici dikdörtgen
  dragging: false,
  startX: 0,
  startY: 0,
};

function updateRedactMeta() {
  const countEl = $('#rdCount');
  if (countEl) countEl.textContent = `${redactState.rects.length} alan seçildi.`;
  const metaEl = $('#rdFileMeta');
  if (metaEl) {
    metaEl.textContent = redactState.img
      ? `${redactState.fileName} · ${redactState.origW}×${redactState.origH} px`
      : '';
  }
  const hasImg = !!redactState.img;
  const hasRects = redactState.rects.length > 0;
  if ($('#rdUndoBtn')) $('#rdUndoBtn').disabled = !hasRects;
  if ($('#rdClearBtn')) $('#rdClearBtn').disabled = !hasRects;
  if ($('#rdDownloadBtn')) $('#rdDownloadBtn').disabled = !hasImg;
  if ($('#rdResetBtn')) $('#rdResetBtn').disabled = !hasImg;
}

function applyRedactToRegion(ctx, sourceImg, box) {
  const x = Math.max(0, Math.round(box.x));
  const y = Math.max(0, Math.round(box.y));
  const w = Math.min(redactState.origW - x, Math.round(box.w));
  const h = Math.min(redactState.origH - y, Math.round(box.h));
  if (w < 2 || h < 2) return;

  const method = box.method || redactState.method;
  const strength = Number(box.strength ?? redactState.strength);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  if (method === 'solid') {
    // Kalıcı, geri getirilemez düz blok (şiddete göre koyu ton)
    const shade = Math.round(18 + (100 - strength) * 0.45);
    ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade + 4})`;
    ctx.fillRect(x, y, w, h);
  } else if (method === 'pixelate') {
    // Mozaik / pikselleştirme etkisi
    const minDim = Math.max(12, Math.min(w, h));
    const blockSize = Math.max(4, Math.round((minDim * (strength / 100)) * 0.34));
    const sw = Math.max(2, Math.round(w / blockSize));
    const sh = Math.max(2, Math.round(h / blockSize));

    const off = document.createElement('canvas');
    off.width = sw;
    off.height = sh;
    const octx = off.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.drawImage(sourceImg, x, y, w, h, 0, 0, sw, sh);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, sw, sh, x, y, w, h);
  } else {
    // Doğal bulanıklaştırma (Blur)
    const radius = Math.max(4, Math.round((Math.max(w, h) * (strength / 100)) * 0.22));
    ctx.filter = `blur(${radius}px)`;
    // Kenar sızıntısını önlemek için bölgeyi biraz taşırarak çiz
    const pad = radius * 2;
    const sx = Math.max(0, x - pad);
    const sy = Math.max(0, y - pad);
    const sw = Math.min(redactState.origW - sx, w + pad * 2);
    const sh = Math.min(redactState.origH - sy, h + pad * 2);
    ctx.drawImage(sourceImg, sx, sy, sw, sh, sx, sy, sw, sh);
    ctx.filter = 'none';
  }

  ctx.restore();
}

function renderRedactCanvas(showGuides = true) {
  const canvas = $('#rdCanvas');
  if (!canvas || !redactState.img) return;
  canvas.width = redactState.origW;
  canvas.height = redactState.origH;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(redactState.img, 0, 0, redactState.origW, redactState.origH);

  for (const r of redactState.rects) {
    applyRedactToRegion(ctx, redactState.img, r);
  }

  if (redactState.draftRect) {
    applyRedactToRegion(ctx, redactState.img, redactState.draftRect);
  }

  if (showGuides) {
    const lineW = Math.max(2, Math.round(Math.max(redactState.origW, redactState.origH) / 550));
    ctx.save();
    ctx.lineWidth = lineW;
    ctx.setLineDash([lineW * 3, lineW * 2]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    for (const r of redactState.rects) {
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
    if (redactState.draftRect) {
      ctx.strokeStyle = '#5b5bf0';
      ctx.strokeRect(redactState.draftRect.x, redactState.draftRect.y, redactState.draftRect.w, redactState.draftRect.h);
    }
    ctx.restore();
  }
}

function canvasPointerCoords(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: Math.max(0, Math.min(canvas.width, (e.clientX - rect.left) * scaleX)),
    y: Math.max(0, Math.min(canvas.height, (e.clientY - rect.top) * scaleY)),
  };
}

async function loadRedactFile(file) {
  if (!file || (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|bmp|gif|avif|tiff?)$/i.test(file.name))) return;
  const decoded = await decodeImageSource(file);
  if (redactState.img && redactState.closeImg) redactState.closeImg();
  redactState.img = decoded.src;
  redactState.closeImg = decoded.close;
  redactState.origW = decoded.w;
  redactState.origH = decoded.h;
  redactState.fileName = file.name;
  redactState.rects = [];
  redactState.draftRect = null;

  $('#rdEmptyState')?.setAttribute('hidden', '');
  $('#rdStageWrap')?.removeAttribute('hidden');
  renderRedactCanvas(true);
  updateRedactMeta();
}

function initRedactTool() {
  const emptyDrop = $('#rdEmptyState');
  const fileIn = $('#rdFile');
  const canvas = $('#rdCanvas');
  if (!emptyDrop || !fileIn || !canvas) return;

  fileIn.addEventListener('change', () => {
    if (fileIn.files?.[0]) loadRedactFile(fileIn.files[0]);
    fileIn.value = '';
  });

  ['dragenter', 'dragover'].forEach(ev => emptyDrop.addEventListener(ev, e => {
    e.preventDefault();
    emptyDrop.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(ev => emptyDrop.addEventListener(ev, e => {
    e.preventDefault();
    emptyDrop.classList.remove('over');
  }));
  emptyDrop.addEventListener('drop', e => {
    e.stopPropagation();
    if (e.dataTransfer?.files?.[0]) loadRedactFile(e.dataTransfer.files[0]);
  });

  // Canvas üzerinde sürükleyerek alan seçimi (Fare + Dokunmatik + Kalem)
  canvas.addEventListener('pointerdown', e => {
    if (!redactState.img) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const pt = canvasPointerCoords(canvas, e);
    redactState.dragging = true;
    redactState.startX = pt.x;
    redactState.startY = pt.y;
    redactState.draftRect = { x: pt.x, y: pt.y, w: 0, h: 0, method: redactState.method, strength: redactState.strength };
  });

  canvas.addEventListener('pointermove', e => {
    if (!redactState.dragging || !redactState.img) return;
    const pt = canvasPointerCoords(canvas, e);
    const x = Math.min(redactState.startX, pt.x);
    const y = Math.min(redactState.startY, pt.y);
    const w = Math.abs(pt.x - redactState.startX);
    const h = Math.abs(pt.y - redactState.startY);
    redactState.draftRect = { x, y, w, h, method: redactState.method, strength: redactState.strength };
    renderRedactCanvas(true);
  });

  const finishDrag = () => {
    if (!redactState.dragging) return;
    redactState.dragging = false;
    const d = redactState.draftRect;
    redactState.draftRect = null;
    if (d && d.w >= 6 && d.h >= 6) {
      redactState.rects.push(d);
    }
    renderRedactCanvas(true);
    updateRedactMeta();
  };
  canvas.addEventListener('pointerup', finishDrag);
  canvas.addEventListener('pointercancel', finishDrag);

  // Yöntem seçimi (Bulanıklaştır / Pikselleştir / Düz blok)
  document.querySelectorAll('[data-rd-method]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-rd-method]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      redactState.method = btn.dataset.rdMethod;
      // Seçili alanların da yöntemini canlı güncelle
      redactState.rects.forEach(r => { r.method = redactState.method; });
      if (redactState.img) renderRedactCanvas(true);
    });
  });

  // Şiddet (Güç) kaydırıcısı
  const strengthIn = $('#rdStrength');
  const strengthVal = $('#rdStrengthVal');
  strengthIn?.addEventListener('input', e => {
    redactState.strength = Number(e.target.value) || 70;
    if (strengthVal) strengthVal.textContent = String(redactState.strength);
    redactState.rects.forEach(r => { r.strength = redactState.strength; });
    if (redactState.img) renderRedactCanvas(true);
  });

  // Geri al / Hepsini sil / Sıfırla
  $('#rdUndoBtn')?.addEventListener('click', () => {
    redactState.rects.pop();
    renderRedactCanvas(true);
    updateRedactMeta();
  });

  $('#rdClearBtn')?.addEventListener('click', () => {
    redactState.rects = [];
    renderRedactCanvas(true);
    updateRedactMeta();
  });

  $('#rdResetBtn')?.addEventListener('click', () => {
    if (redactState.img && redactState.closeImg) redactState.closeImg();
    redactState.img = null;
    redactState.rects = [];
    redactState.draftRect = null;
    $('#rdStageWrap')?.setAttribute('hidden', '');
    $('#rdEmptyState')?.removeAttribute('hidden');
    updateRedactMeta();
  });

  $('#rdFormat')?.addEventListener('change', e => {
    redactState.outFormat = e.target.value;
  });

  // İndir (Kesik seçim çizgileri olmadan temiz çıktı üretir)
  $('#rdDownloadBtn')?.addEventListener('click', () => {
    if (!redactState.img) return;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = redactState.origW;
    outCanvas.height = redactState.origH;
    const octx = outCanvas.getContext('2d');
    const mime = redactState.outFormat;
    if (mime === 'image/jpeg') {
      octx.fillStyle = '#ffffff';
      octx.fillRect(0, 0, outCanvas.width, outCanvas.height);
    }
    octx.drawImage(redactState.img, 0, 0, redactState.origW, redactState.origH);
    for (const r of redactState.rects) {
      applyRedactToRegion(octx, redactState.img, r);
    }
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const stem = (redactState.fileName || 'fotograf').replace(/\.[^.]+$/, '');
    outCanvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: `${stem}-gizli.${ext}` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }, mime, mime === 'image/png' ? undefined : 0.94);
  });

  updateRedactMeta();
}

export function initPhotoTools() {
  initResizeTool();
  initRedactTool();
  initMetadataTool();
}

/* ==========================================================================
   3. FOTOĞRAF METADATA STÜDYOSU (EXIF inceleme + metadata'sız kopya)
   ========================================================================== */
const metadataState = { items: [], selectedId: null, nextId: 1, running: false };

function readExifFromJpeg(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return {};
  let pos = 2;
  while (pos + 4 < view.byteLength) {
    if (view.getUint8(pos) !== 0xff) break;
    const marker = view.getUint8(pos + 1);
    if (marker === 0xda || marker === 0xd9) break;
    const length = view.getUint16(pos + 2);
    if (length < 2 || pos + 2 + length > view.byteLength) break;
    if (marker === 0xe1 && length >= 8 && view.getUint32(pos + 4) === 0x45786966 && view.getUint16(pos + 8) === 0) {
      const tiff = pos + 10;
      const little = view.getUint16(tiff) === 0x4949;
      const u16 = o => view.getUint16(o, little);
      const u32 = o => view.getUint32(o, little);
      if (!little && view.getUint16(tiff) !== 0x4d4d) return {};
      if (u16(tiff + 2) !== 42) return {};
      const base = tiff;
      const tags = {};
      const readIfd = offset => {
        const start = base + offset;
        if (start < base || start + 2 > view.byteLength) return null;
        const count = Math.min(u16(start), 512);
        const out = {};
        for (let i = 0; i < count; i++) {
          const e = start + 2 + i * 12;
          if (e + 12 > view.byteLength) break;
          const tag = u16(e), type = u16(e + 2), n = u32(e + 4);
          const sizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
          const unit = sizes[type];
          if (!unit || n > 100000) continue;
          const bytes = unit * n;
          const data = bytes <= 4 ? e + 8 : base + u32(e + 8);
          if (data < base || data + bytes > view.byteLength) continue;
          const scalar = k => type === 3 ? view.getUint16(data + k * 2, little) : type === 4 ? view.getUint32(data + k * 4, little) : type === 9 ? view.getInt32(data + k * 4, little) : null;
          let value = null;
          if (type === 2) value = new TextDecoder().decode(new Uint8Array(buffer, data, Math.max(0, n - 1))).replace(/[\0\s]+$/g, '');
          else if (type === 5 || type === 10) {
            const signed = type === 10;
            const arr = [];
            for (let k = 0; k < Math.min(n, 16); k++) {
              const a = signed ? view.getInt32(data + k * 8, little) : u32(data + k * 8);
              const b = signed ? view.getInt32(data + k * 8 + 4, little) : u32(data + k * 8 + 4);
              arr.push(b ? a / b : 0);
            }
            value = n === 1 ? arr[0] : arr;
          } else if (type === 1 || type === 7) value = Array.from(new Uint8Array(buffer, data, Math.min(n, 32)));
          else value = n === 1 ? scalar(0) : Array.from({ length: Math.min(n, 16) }, (_, k) => scalar(k));
          out[tag] = value;
        }
        return out;
      };
      const ifd0 = readIfd(u32(base + 4)) || {};
      Object.assign(tags, ifd0);
      const exif = ifd0[0x8769] ? readIfd(ifd0[0x8769]) || {} : {};
      const gps = ifd0[0x8825] ? readIfd(ifd0[0x8825]) || {} : {};
      const names = {
        0x010f: ['Kamera üreticisi', ifd0[0x010f]], 0x0110: ['Kamera modeli', ifd0[0x0110]],
        0x0131: ['Yazılım', ifd0[0x0131]], 0x0132: ['Dosya tarihi', ifd0[0x0132]],
        0x9003: ['Çekim tarihi', exif[0x9003]], 0x9004: ['Dijitalleştirme tarihi', exif[0x9004]],
        0x829a: ['Pozlama süresi', exif[0x829a] ? `1/${Math.round(1 / exif[0x829a])} sn`.replace('1/0', '0') : null],
        0x829d: ['Diyafram', exif[0x829d] ? `f/${(Math.sqrt(2) ** exif[0x829d]).toFixed(1)}` : null],
        0x8827: ['ISO', exif[0x8827]], 0x920a: ['Odak uzaklığı', exif[0x920a] ? `${exif[0x920a]} mm` : null],
        0x0112: ['Yön', ifd0[0x0112]],
      };
      const result = {};
      for (const [key, [label, value]] of Object.entries(names)) if (value != null && value !== '') result[label] = Array.isArray(value) ? value.join(', ') : String(value);
      if (gps[1] && gps[2] && gps[3] && gps[4]) {
        const dms = v => Array.isArray(v) ? v : [0, 0, 0];
        const toDec = (v, ref) => {
          const a = dms(v); const dec = (a[0] || 0) + (a[1] || 0) / 60 + (a[2] || 0) / 3600;
          return (ref === 'S' || ref === 'W' ? -dec : dec).toFixed(6);
        };
        const latRef = typeof gps[1] === 'string' ? gps[1].trim() : String.fromCharCode(...(Array.isArray(gps[1]) ? gps[1] : []).filter(Number.isFinite));
        const lonRef = typeof gps[3] === 'string' ? gps[3].trim() : String.fromCharCode(...(Array.isArray(gps[3]) ? gps[3] : []).filter(Number.isFinite));
        result['GPS konumu'] = `${toDec(gps[2], latRef)}, ${toDec(gps[4], lonRef)}`;
      }
      if (ifd0[0x010e]) result['Açıklama'] = String(ifd0[0x010e]);
      return result;
    }
    pos += 2 + length;
  }
  return {};
}

function renderMetadataList() {
  const list = $('#mdList');
  const clean = $('#mdCleanBtn');
  const clear = $('#mdClearBtn');
  if (!list) return;
  list.replaceChildren();
  for (const item of metadataState.items) {
    const row = el('li', { class: 'rs-item' });
    const head = el('div', { class: 'rs-item-info' }, el('strong', {}, item.file.name), el('span', { class: 'meta' }, fmtSize(item.file.size)));
    row.append(head);
    if (item.error) row.append(el('p', { class: 'note' }, item.error));
    else {
      const facts = [
        ['Tür', item.file.type || 'Bilinmiyor'],
        ['Boyut', `${item.width} × ${item.height} px`],
        ['Son değiştirilme', item.file.lastModified ? new Date(item.file.lastModified).toLocaleString('tr-TR') : 'Bilinmiyor'],
        ...Object.entries(item.exif),
      ];
      const grid = el('div', { class: 'pt-inline' });
      for (const [label, value] of facts) grid.append(el('span', { class: 'meta' }, `${label}: ${value}`));
      row.append(grid);
      if (!Object.keys(item.exif).length) row.append(el('p', { class: 'meta' }, 'Okunabilir EXIF alanı bulunamadı. Bu, dosyada hiçbir metadata olmadığı anlamına gelmez.'));
    }
    row.append(el('button', { type: 'button', class: 'btn ghost small', onclick: () => {
      metadataState.items = metadataState.items.filter(x => x.id !== item.id);
      renderMetadataList();
    } }, 'Kaldır'));
    list.append(row);
  }
  if (clean) clean.disabled = metadataState.running || !metadataState.items.some(i => !i.error && i.file.type.startsWith('image/'));
  if (clear) clear.disabled = metadataState.running || !metadataState.items.length;
}

async function addMetadataFiles(files) {
  for (const file of Array.from(files || [])) {
    if (!file.type.startsWith('image/')) continue;
    const item = { id: metadataState.nextId++, file, exif: {}, width: 0, height: 0, error: null };
    metadataState.items.push(item);
    renderMetadataList();
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('100 MB üzerindeki dosyalar bu araçta işlenmiyor.');
      const [buffer, decoded] = await Promise.all([file.arrayBuffer(), decodeImageSource(file)]);
      item.width = decoded.w; item.height = decoded.h;
      const tooLarge = decoded.w * decoded.h > 80000000;
      decoded.close();
      if (tooLarge) throw new Error('80 megapiksel üzerindeki görseller bellek güvenliği için desteklenmiyor.');
      if (/jpe?g/i.test(file.type) || /\.jpe?g$/i.test(file.name)) item.exif = readExifFromJpeg(buffer);
      else item.exif = {};
    } catch (err) { item.error = err?.message || 'Dosya okunamadı.'; }
    renderMetadataList();
  }
}

function initMetadataTool() {
  const drop = $('#mdDrop'), input = $('#mdFile');
  if (!drop || !input) return;
  input.addEventListener('change', () => { addMetadataFiles(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { e.stopPropagation(); addMetadataFiles(e.dataTransfer?.files); });
  $('#mdClearBtn')?.addEventListener('click', () => { metadataState.items = []; renderMetadataList(); });
  $('#mdCleanBtn')?.addEventListener('click', async () => {
    if (metadataState.running) return;
    metadataState.running = true; renderMetadataList();
    const status = $('#mdStatus');
    if (status) { status.hidden = false; status.textContent = 'Metadata’sız kopyalar hazırlanıyor…'; }
    let done = 0;
    try {
      const entries = [];
      const used = new Set();
      for (const item of metadataState.items.filter(i => !i.error && i.file.type.startsWith('image/'))) {
        const decoded = await decodeImageSource(item.file);
        try {
          if (decoded.w * decoded.h > 80000000) throw new Error(`${item.file.name}: 80 megapiksel sınırı aşıldı.`);
          const mime = item.file.type === 'image/png' ? 'image/png' : item.file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
          const canvas = document.createElement('canvas');
          canvas.width = decoded.w; canvas.height = decoded.h;
          const ctx = canvas.getContext('2d', { alpha: mime !== 'image/jpeg' });
          if (mime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
          ctx.drawImage(decoded.src, 0, 0);
          const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, mime === 'image/jpeg' ? 0.94 : undefined));
          if (!blob) throw new Error(`${item.file.name}: görsel çıktı oluşturulamadı.`);
          const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
          const stem = item.file.name.replace(/\.[^.]+$/, '') || 'fotograf';
          let name = `${stem}-metadata-temiz.${ext}`, n = 2;
          while (used.has(name.toLowerCase())) name = `${stem}-metadata-temiz-${n++}.${ext}`;
          used.add(name.toLowerCase());
          entries.push({ name, data: blob });
          done++;
        } finally { decoded.close(); }
      }
      if (entries.length) {
        const zipBlob = await makeZip(entries);
        const url = URL.createObjectURL(zipBlob);
        const a = el('a', { href: url, download: 'kontak-metadata-temiz.zip' });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      if (status) status.textContent = `${done} temizlenmiş kopya ZIP olarak hazırlandı. Orijinal dosyalar değiştirilmedi.`;
    } catch (err) {
      if (status) status.textContent = `İşlem durdu: ${err?.message || err}. Hazırlanan dosya sayısı: ${done}.`;
    } finally { metadataState.running = false; renderMetadataList(); }
  });
}

