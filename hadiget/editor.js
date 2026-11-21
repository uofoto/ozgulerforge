// Görsel üzerine çizim/işaretleme editörü (kalem, fosforlu, ok, kutu, metin).
// <dialog> kullanır: odak tuzağı ve Esc ile kapanma tarayıcıdan gelir.

import { t } from './i18n.js';

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#111111', '#ffffff'];
const MAX_SIDE = 3000;

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
    else e.setAttribute(k, attrs[k]);
  }
  e.append(...kids);
  return e;
}

// opts: { name, canSend(): bool, onSave(blob, fileName), onSend(blob, fileName) }
export async function openEditor(blob, opts) {
  let bmp;
  try {
    bmp = await createImageBitmap(blob);
  } catch {
    alert(t('ed.loadFail'));
    return;
  }
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const W = Math.round(bmp.width * k);
  const H = Math.round(bmp.height * k);
  const unit = Math.max(W, H) / 220; // çizgi kalınlığı birimi

  const ops = [];
  let tool = 'pen';
  let color = COLORS[0];
  let size = 1; // 0,1,2
  let cur = null;
  let pendingText = null;

  const canvas = el('canvas', { class: 'ed-canvas', width: W, height: H, role: 'img', 'aria-label': opts.name || '' });
  const ctx = canvas.getContext('2d');

  const widthOf = (s) => unit * [1, 2.4, 5][s];

  function drawOp(o) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = o.color;
    ctx.fillStyle = o.color;
    if (o.type === 'pen' || o.type === 'marker') {
      ctx.lineWidth = o.type === 'marker' ? o.w * 4 : o.w;
      if (o.type === 'marker') {
        ctx.globalAlpha = 0.35;
        ctx.lineCap = 'butt';
      }
      ctx.beginPath();
      o.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      if (o.pts.length === 1) ctx.lineTo(o.pts[0][0] + 0.01, o.pts[0][1]);
      ctx.stroke();
    } else if (o.type === 'rect') {
      ctx.lineWidth = o.w;
      ctx.strokeRect(o.x1, o.y1, o.x2 - o.x1, o.y2 - o.y1);
    } else if (o.type === 'arrow') {
      ctx.lineWidth = o.w;
      const a = Math.atan2(o.y2 - o.y1, o.x2 - o.x1);
      const head = Math.max(o.w * 4, 12);
      ctx.beginPath();
      ctx.moveTo(o.x1, o.y1);
      ctx.lineTo(o.x2, o.y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(o.x2, o.y2);
      ctx.lineTo(o.x2 - head * Math.cos(a - 0.45), o.y2 - head * Math.sin(a - 0.45));
      ctx.lineTo(o.x2 - head * Math.cos(a + 0.45), o.y2 - head * Math.sin(a + 0.45));
      ctx.closePath();
      ctx.fill();
    } else if (o.type === 'text') {
      const px = o.w * 6;
      ctx.font = `700 ${px}px system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.lineWidth = px / 6;
      ctx.strokeStyle = o.color === '#ffffff' || o.color === '#f59e0b' ? '#000000' : '#ffffff';
      ctx.strokeText(o.text, o.x1, o.y1);
      ctx.fillText(o.text, o.x1, o.y1);
    }
    ctx.restore();
  }

  let raf = 0;
  function redraw() {
    raf = 0;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bmp, 0, 0, W, H);
    ops.forEach(drawOp);
    if (cur) drawOp(cur);
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(redraw); };

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    const [x, y] = pos(e);
    if (tool === 'text') {
      pendingText = [x, y];
      textRow.hidden = false;
      hint.hidden = true;
      textInput.focus();
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    const base = { color, w: widthOf(size) };
    cur = tool === 'pen' || tool === 'marker'
      ? { type: tool, ...base, pts: [[x, y]] }
      : { type: tool, ...base, x1: x, y1: y, x2: x, y2: y };
    schedule();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!cur) return;
    const [x, y] = pos(e);
    if (cur.pts) cur.pts.push([x, y]);
    else { cur.x2 = x; cur.y2 = y; }
    schedule();
  });
  const end = () => {
    if (!cur) return;
    ops.push(cur);
    cur = null;
    schedule();
    sync();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  // --- araç çubuğu ---
  const dlg = el('dialog', { class: 'editor', 'aria-label': t('ed.title') });
  const toolBtns = {};
  const mkTool = (id, label) => {
    const b = el('button', { type: 'button', class: 'ed-tool', 'aria-pressed': String(id === tool), onclick: () => setTool(id) }, label);
    toolBtns[id] = b;
    return b;
  };
  function setTool(id) {
    tool = id;
    for (const k2 in toolBtns) toolBtns[k2].setAttribute('aria-pressed', String(k2 === id));
    hint.hidden = id !== 'text';
    if (id !== 'text') textRow.hidden = true;
  }

  const colorBtns = COLORS.map((c) => {
    const b = el('button', { type: 'button', class: 'ed-color', style: `background:${c}`, 'aria-label': t('ed.color') + ' ' + c, 'aria-pressed': String(c === color), onclick: () => {
      color = c;
      colorBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    } });
    return b;
  });
  const sizeBtns = [0, 1, 2].map((s) => {
    const b = el('button', { type: 'button', class: 'ed-size', 'aria-label': `${t('ed.size')} ${s + 1}`, 'aria-pressed': String(s === size), onclick: () => {
      size = s;
      sizeBtns.forEach((x, i) => x.setAttribute('aria-pressed', String(i === s)));
    } }, el('i', { style: `width:${6 + s * 5}px;height:${6 + s * 5}px` }));
    return b;
  });

  const undo = el('button', { type: 'button', onclick: () => { ops.pop(); schedule(); sync(); } }, t('ed.undo'));
  const clear = el('button', { type: 'button', onclick: () => { ops.length = 0; schedule(); sync(); } }, t('ed.clear'));

  const textInput = el('input', { type: 'text', placeholder: t('ed.textPh'), 'aria-label': t('ed.textPh'), maxlength: '120' });
  const addText = () => {
    const v = textInput.value.trim();
    if (v && pendingText) ops.push({ type: 'text', color, w: widthOf(size) * 2.2, x1: pendingText[0], y1: pendingText[1], text: v });
    textInput.value = '';
    pendingText = null;
    textRow.hidden = true;
    schedule();
    sync();
  };
  textInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addText(); } });
  const textRow = el('div', { class: 'ed-textrow', hidden: '' }, textInput, el('button', { type: 'button', class: 'primary', onclick: addText }, t('ed.textAdd')));
  const hint = el('p', { class: 'ed-hint', hidden: '' }, t('ed.textHint'));

  const outType = blob.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  const base = (opts.name || 'image').replace(/\.[^.]+$/, '').replace(new RegExp(`(-${t('ed.edited')})+$`), '');
  const outName = `${base}-${t('ed.edited')}.${outType === 'image/jpeg' ? 'jpg' : 'png'}`;
  const render = () => new Promise((res) => {
    if (raf) { cancelAnimationFrame(raf); redraw(); }
    canvas.toBlob((b) => res(b), outType, 0.92);
  });

  const close = () => { dlg.close(); };
  const saveBtn = el('button', { type: 'button', class: 'primary', onclick: async () => { opts.onSave?.(await render(), outName); } }, t('ed.save'));
  const sendBtn = el('button', { type: 'button', onclick: async () => { opts.onSend?.(await render(), outName); close(); } }, t('ed.send'));
  const closeBtn = el('button', { type: 'button', onclick: close }, t('ed.cancel'));
  function sync() {
    undo.disabled = clear.disabled = !ops.length;
    sendBtn.hidden = !opts.canSend?.();
  }

  dlg.append(
    el('div', { class: 'ed-top' }, el('strong', {}, t('ed.title')), closeBtn),
    el('div', { class: 'ed-stage' }, canvas),
    hint,
    textRow,
    el('div', { class: 'ed-bar' },
      el('div', { class: 'ed-group', role: 'group', 'aria-label': t('ed.title') },
        mkTool('pen', t('ed.pen')), mkTool('marker', t('ed.marker')), mkTool('arrow', t('ed.arrow')), mkTool('rect', t('ed.rect')), mkTool('text', t('ed.text'))),
      el('div', { class: 'ed-group', role: 'group', 'aria-label': t('ed.color') }, ...colorBtns),
      el('div', { class: 'ed-group', role: 'group', 'aria-label': t('ed.size') }, ...sizeBtns, undo, clear)),
    el('div', { class: 'ed-actions' }, saveBtn, sendBtn)
  );
  dlg.addEventListener('close', () => { dlg.remove(); bmp.close?.(); });
  document.body.append(dlg);
  dlg.showModal();
  redraw();
  sync();
}
