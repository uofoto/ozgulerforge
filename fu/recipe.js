/* Fotoğraf Ustası – Reçete motoru
   Lightroom tarzı ayrıntılı ayarlar: ışık, renk, doku/netlik/duman giderme, keskinleştirme,
   HSL, parametrik ton eğrisi, kalibrasyon, bölgesel maskeler, vinyet ve gren.
   Tüm hesaplar cihazda yapılır; boyuta göre ölçeklendiği için önizleme ve dışa aktarma aynı görünür. */
(() => {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const bump = (y, c, s) => Math.exp(-0.5 * ((y - c) / s) ** 2);

  /* ---------- Ayar tanımları (kaydırıcılar bu listeden otomatik üretilir) ---------- */
  const S = (key, label, min, max, def = 0, step = 1) => ({ key, label, min, max, def, step });
  const GROUPS = [
    { id: 'light', title: 'Işık', open: true, items: [
      S('lrExposure', 'Pozlama (EV)', -3, 3, 0, .05), S('lrContrast', 'Kontrast', -100, 100), S('lrHighlights', 'Parlak alanlar', -100, 100),
      S('lrShadows', 'Gölgeler', -100, 100), S('lrWhites', 'Beyazlar', -100, 100), S('lrBlacks', 'Siyahlar', -100, 100)] },
    { id: 'color', title: 'Renk', items: [
      S('lrTemp', 'Sıcaklık', -50, 50), S('lrTint', 'Ton (Tint)', -50, 50), S('lrVibrance', 'Canlılık', -100, 100), S('lrSaturation', 'Doygunluk', -100, 100)] },
    { id: 'texture', title: 'Doku, netlik, duman giderme', items: [
      S('lrTexture', 'Doku', -100, 100), S('lrClarity', 'Netlik (Clarity)', -100, 100), S('lrDehaze', 'Duman giderme (Dehaze)', -100, 100)] },
    { id: 'detail', title: 'Ayrıntılar (keskinleştirme)', items: [
      S('lrSharpAmount', 'Keskinleştirme', 0, 150), S('lrSharpRadius', 'Yarıçap', .5, 3, 1, .1), S('lrSharpDetail', 'Detay', 0, 100, 25), S('lrSharpMasking', 'Maskeleme', 0, 100)] },
    { id: 'hsl-green', title: 'HSL · Yeşiller', items: [S('lrGreenHue', 'Ton', -100, 100), S('lrGreenSat', 'Doygunluk', -100, 100), S('lrGreenLum', 'Açıklık', -100, 100)] },
    { id: 'hsl-blue', title: 'HSL · Maviler', items: [S('lrBlueHue', 'Ton', -100, 100), S('lrBlueSat', 'Doygunluk', -100, 100), S('lrBlueLum', 'Açıklık', -100, 100)] },
    { id: 'hsl-aqua', title: 'HSL · Aqua (su yeşili)', items: [S('lrAquaHue', 'Ton', -100, 100), S('lrAquaSat', 'Doygunluk', -100, 100), S('lrAquaLum', 'Açıklık', -100, 100)] },
    { id: 'curve', title: 'Ton eğrisi (parametrik)', items: [
      S('lrCurveBlack', 'Siyah nokta', -100, 100), S('lrCurveDarks', 'Koyu tonlar', -100, 100), S('lrCurveMids', 'Orta tonlar', -100, 100),
      S('lrCurveLights', 'Açık tonlar', -100, 100), S('lrCurveWhite', 'Beyaz nokta', -100, 100)] },
    { id: 'fx', title: 'Efektler', items: [
      S('lrVigAmount', 'Vinyet', -100, 100), S('lrVigMid', 'Orta nokta', 0, 100, 50), S('lrVigRound', 'Yuvarlaklık', -100, 100),
      S('lrVigFeather', 'Geçiş (feather)', 0, 100, 50), S('lrVigHighlights', 'Aydınlatma (highlights)', 0, 100),
      S('lrGrainAmount', 'Tane (grain)', 0, 100), S('lrGrainSize', 'Tane boyutu', 0, 100, 25), S('lrGrainRough', 'Tane pürüzlülüğü', 0, 100, 50)] },
    { id: 'calibration', title: 'Kalibrasyon', items: [
      S('lrCalShadowTint', 'Gölge tonu', -100, 100),
      S('lrCalRedHue', 'Kırmızı birincil · Ton', -100, 100), S('lrCalRedSat', 'Kırmızı birincil · Doygunluk', -100, 100),
      S('lrCalGreenHue', 'Yeşil birincil · Ton', -100, 100), S('lrCalGreenSat', 'Yeşil birincil · Doygunluk', -100, 100),
      S('lrCalBlueHue', 'Mavi birincil · Ton', -100, 100), S('lrCalBlueSat', 'Mavi birincil · Doygunluk', -100, 100)] },
    { id: 'masks', title: 'Bölgesel maskeler (otomatik)', items: [
      S('lrM1Exp', '1 · Merkez dağ (radyal) · Pozlama', -2, 2, 0, .05), S('lrM1Clarity', '1 · Merkez dağ · Netlik', -100, 100),
      S('lrM2Exp', '2 · Kayalıkların koyu bölgeleri · Pozlama', -2, 2, 0, .05), S('lrM2Shadows', '2 · Kayalıkların koyu bölgeleri · Gölgeler', -100, 100),
      S('lrM3Exp', '3 · Üst gökyüzü (gradyan) · Pozlama', -2, 2, 0, .05), S('lrM3Dehaze', '3 · Üst gökyüzü · Duman giderme', -100, 100),
      S('lrM4Exp', '4 · Sis bölgeleri · Pozlama', -2, 2, 0, .05), S('lrM4Clarity', '4 · Sis bölgeleri · Netlik', -100, 100),
      S('lrM5Exp', '5 · Alt ön plan (gradyan) · Pozlama', -2, 2, 0, .05), S('lrM5Clarity', '5 · Alt ön plan · Netlik', -100, 100)] },
  ];
  const STRENGTH = S('lrStrength', 'Reçete gücü', 0, 100, 100);

  const DEFAULTS = { lrStrength: STRENGTH.def };
  for (const g of GROUPS) for (const it of g.items) DEFAULTS[it.key] = it.def;
  Object.freeze(DEFAULTS);

  // Tek başına görsel etki üretmeyen (varsayılanı sıfır olmayan) anahtarlar: "aktif mi" kararında yok sayılır.
  const PASSIVE = new Set(['lrStrength', 'lrSharpRadius', 'lrSharpDetail', 'lrSharpMasking', 'lrVigMid', 'lrVigRound', 'lrVigFeather',
    'lrVigHighlights', 'lrGrainSize', 'lrGrainRough']);
  const EFFECT_KEYS = Object.keys(DEFAULTS).filter((k) => !PASSIVE.has(k));
  const isActive = (v) => (v.lrStrength ?? 100) > 0 && EFFECT_KEYS.some((k) => Number(v[k]) !== 0 && v[k] !== undefined);

  /* ---------- Hazır reçeteler ---------- */
  const PRESETS = {
    mistyMountain: Object.freeze({
      lrExposure: -.65, lrContrast: 28, lrHighlights: -55, lrShadows: -25, lrWhites: -18, lrBlacks: -32,
      lrTemp: -6, lrTint: 2, lrVibrance: -5, lrSaturation: -8,
      lrTexture: 15, lrClarity: 18, lrDehaze: 22,
      lrSharpAmount: 40, lrSharpRadius: .9, lrSharpDetail: 25, lrSharpMasking: 60,
      lrGreenHue: 0, lrGreenSat: -10, lrGreenLum: -12, lrBlueHue: 0, lrBlueSat: -15, lrBlueLum: -18, lrAquaHue: 0, lrAquaSat: -10, lrAquaLum: -8,
      lrCurveBlack: -8, lrCurveDarks: -10, lrCurveMids: -3, lrCurveLights: 5, lrCurveWhite: -8,
      lrVigAmount: -15, lrVigMid: 35, lrVigRound: 0, lrVigFeather: 75, lrVigHighlights: 0,
      lrGrainAmount: 8, lrGrainSize: 20, lrGrainRough: 30,
      lrCalShadowTint: 0, lrCalRedHue: 5, lrCalRedSat: -5, lrCalGreenHue: -10, lrCalGreenSat: -5, lrCalBlueHue: -10, lrCalBlueSat: -10,
      lrM1Exp: .15, lrM1Clarity: 10, lrM2Exp: -.20, lrM2Shadows: -20, lrM3Exp: -.35, lrM3Dehaze: 10, lrM4Exp: .10, lrM4Clarity: -5, lrM5Exp: -.15, lrM5Clarity: 5,
      lrStrength: 100, effectStrength: 100,
    }),
  };

  /* ---------- Yardımcılar ---------- */
  function boxBlur(src, gw, gh, r, passes) {
    let a = Float32Array.from(src); let b = new Float32Array(src.length);
    const win = 2 * r + 1;
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < gh; y++) {
        const row = y * gw; let sum = 0;
        for (let k = -r; k <= r; k++) sum += a[row + clamp(k, 0, gw - 1)];
        for (let x = 0; x < gw; x++) { b[row + x] = sum / win; sum += a[row + clamp(x + r + 1, 0, gw - 1)] - a[row + clamp(x - r, 0, gw - 1)]; }
      }
      for (let x = 0; x < gw; x++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) sum += b[clamp(k, 0, gh - 1) * gw + x];
        for (let y = 0; y < gh; y++) { a[y * gw + x] = sum / win; sum += b[clamp(y + r + 1, 0, gh - 1) * gw + x] - b[clamp(y - r, 0, gh - 1) * gw + x]; }
      }
    }
    return a;
  }

  const HSL = new Float32Array(3);
  function rgb2hsl(r, g, b) {
    const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn; const l = (mx + mn) / 2;
    let h = 0; let s = 0;
    if (d > 1e-5) {
      s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h *= 60;
    }
    HSL[0] = h; HSL[1] = s; HSL[2] = l;
  }
  const RGB = new Float32Array(3);
  function hue2(p, q, t) {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < .5) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p;
  }
  function hsl2rgb(h, s, l) {
    if (s <= 1e-5) { RGB[0] = RGB[1] = RGB[2] = l; return; }
    const q = l < .5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q; const hh = (((h % 360) + 360) % 360) / 360;
    RGB[0] = hue2(p, q, hh + 1 / 3); RGB[1] = hue2(p, q, hh); RGB[2] = hue2(p, q, hh - 1 / 3);
  }
  const tri = (h, center, half) => {
    let d = Math.abs(h - center); if (d > 180) d = 360 - d;
    const t = clamp(1 - d / half, 0, 1); return t * t * (3 - 2 * t);
  };
  function hash(x, y) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) ^ 0x5bd1e995;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 2147483647.5 - 1;
  }
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  function buildToneLUT(v) {
    const N = 1024; const lut = new Float32Array(N + 1);
    const c = v.lrContrast / 100; const hi = v.lrHighlights / 100; const sh = v.lrShadows / 100; const wh = v.lrWhites / 100; const bl = v.lrBlacks / 100;
    const cb = v.lrCurveBlack / 100; const cd = v.lrCurveDarks / 100; const cm = v.lrCurveMids / 100; const cl = v.lrCurveLights / 100; const cw = v.lrCurveWhite / 100;
    for (let i = 0; i <= N; i++) {
      const y = i / N; const t = 2 * y - 1;
      let d = c * .36 * (t - t * t * t);
      d += hi * .22 * sstep(.42, .92, y) * (1 - .45 * sstep(.92, 1, y));
      d += sh * .16 * sstep(0, .12, y) * (1 - sstep(.3, .72, y));
      d += wh * .12 * sstep(.55, 1, y);
      d += bl * .09 * (1 - sstep(0, .4, y));
      d += cb * .08 * (1 - sstep(0, .25, y));
      d += cd * .12 * bump(y, .25, .17) + cm * .12 * bump(y, .5, .2) + cl * .12 * bump(y, .75, .17);
      d += cw * .08 * sstep(.75, 1, y);
      lut[i] = d;
    }
    return lut;
  }

  /* ---------- Ana işlem: Uint8ClampedArray RGBA üzerinde yerinde çalışır ---------- */
  async function process(data, w, h, input, opt = {}) {
    const isCancelled = opt.isCancelled || (() => false);
    const onProgress = opt.onProgress || null;
    const v = { ...DEFAULTS, ...input };
    const strength = clamp(v.lrStrength, 0, 100) / 100;
    if (!isActive(v)) return true;
    const minSide = Math.min(w, h); const unit = Math.max(1, minSide / 1000);

    const has = (...keys) => keys.some((k) => Number(v[k]) !== 0);
    const hasMask = [has('lrM1Exp', 'lrM1Clarity'), has('lrM2Exp', 'lrM2Shadows'), has('lrM3Exp', 'lrM3Dehaze'), has('lrM4Exp', 'lrM4Clarity'), has('lrM5Exp', 'lrM5Clarity')];
    const useClarity = has('lrClarity', 'lrM1Clarity', 'lrM4Clarity', 'lrM5Clarity');
    const useDehaze = has('lrDehaze', 'lrM3Dehaze');
    const useTexture = has('lrTexture');
    const useSharp = v.lrSharpAmount > 0;
    const useHSL = has('lrGreenHue', 'lrGreenSat', 'lrGreenLum', 'lrBlueHue', 'lrBlueSat', 'lrBlueLum', 'lrAquaHue', 'lrAquaSat', 'lrAquaLum');
    const useCal = has('lrCalRedHue', 'lrCalRedSat', 'lrCalGreenHue', 'lrCalGreenSat', 'lrCalBlueHue', 'lrCalBlueSat');
    const useVig = v.lrVigAmount !== 0; const useGrain = v.lrGrainAmount > 0;

    /* 1) Parlaklık haritası + kaba ızgara (netlik / duman giderme için) */
    const L0 = new Float32Array(w * h);
    const f = Math.max(1, Math.ceil(Math.max(w, h) / 200));
    const gw = Math.ceil(w / f); const gh = Math.ceil(h / f);
    let Ls = new Float32Array(gw * gh); let Ms = new Float32Array(gw * gh); const cnt = new Uint16Array(gw * gh);
    for (let y = 0; y < h; y++) {
      const gy = ((y / f) | 0) * gw;
      for (let x = 0; x < w; x++) {
        const p = y * w + x; const i = p * 4;
        const r = data[i] / 255; const g = data[i + 1] / 255; const b = data[i + 2] / 255;
        const l = .2126 * r + .7152 * g + .0722 * b; L0[p] = l;
        const gi = gy + ((x / f) | 0); Ls[gi] += l; Ms[gi] += Math.min(r, g, b); cnt[gi]++;
      }
      if ((y & 127) === 127) { if (isCancelled()) return false; await tick(); }
    }
    for (let i = 0; i < Ls.length; i++) { Ls[i] /= cnt[i] || 1; Ms[i] /= cnt[i] || 1; }
    const Lmed = useClarity ? boxBlur(Ls, gw, gh, Math.max(1, Math.round(.022 * minSide / f)), 2) : null;
    let Dark = null; let atm = .9;
    if (useDehaze) {
      Dark = boxBlur(Ms, gw, gh, Math.max(2, Math.round(.07 * minSide / f)), 2);
      const sorted = Float32Array.from(Ls).sort(); atm = clamp(sorted[Math.floor(sorted.length * .97)] || .9, .6, .98);
    }
    Ls = null; Ms = null;

    const gx0 = new Int32Array(w); const gx1 = new Int32Array(w); const gfx = new Float32Array(w);
    for (let x = 0; x < w; x++) {
      const gx = clamp((x + .5) / f - .5, 0, gw - 1); const x0 = Math.floor(gx);
      gx0[x] = x0; gx1[x] = Math.min(gw - 1, x0 + 1); gfx[x] = gx - x0;
    }
    const sample = (arr, y0, y1, fy, x) => {
      const a = arr[y0 + gx0[x]]; const b = arr[y0 + gx1[x]]; const c = arr[y1 + gx0[x]]; const d = arr[y1 + gx1[x]];
      const fx = gfx[x]; return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    };

    /* 2) Sabitler */
    const toneLUT = buildToneLUT(v);
    const rt = Math.max(1, Math.round(unit * 2.2));
    const rs = Math.max(1, Math.round(unit * v.lrSharpRadius));
    const texK = v.lrTexture / 100 * .9;
    const sharpK = v.lrSharpAmount / 100 * .9; const detailFrac = v.lrSharpDetail / 100; const maskAmt = v.lrSharpMasking / 100;
    const tr = v.lrTemp * .0022; const tint = v.lrTint * .0016;
    const vibr = v.lrVibrance / 100; const satG = 1 + v.lrSaturation / 100;
    const shadowTint = v.lrCalShadowTint / 100 * .05;
    const hueDeg = .3;

    // Kalibrasyon matrisi (satırlar beyazı beyaz tutacak şekilde normalize edilir)
    let M = null;
    if (useCal) {
      const hR = v.lrCalRedHue / 100 * .35; const hG = v.lrCalGreenHue / 100 * .35; const hB = v.lrCalBlueHue / 100 * .35;
      const dR = -v.lrCalRedSat / 100 * .6; const dG = -v.lrCalGreenSat / 100 * .6; const dB = -v.lrCalBlueSat / 100 * .6;
      const cR = [1, Math.max(0, hR), Math.max(0, -hR)]; const cG = [Math.max(0, -hG), 1, Math.max(0, hG)]; const cB = [Math.max(0, hB), Math.max(0, -hB), 1];
      const mixC = (c, d, gray) => c.map((val) => (1 - d) * val + d * gray);
      const colR = mixC(cR, dR, .2126); const colG = mixC(cG, dG, .7152); const colB = mixC(cB, dB, .0722);
      M = new Float32Array(9);
      for (let row = 0; row < 3; row++) {
        const a = colR[row]; const b = colG[row]; const c = colB[row]; const s = (a + b + c) || 1;
        M[row * 3] = a / s; M[row * 3 + 1] = b / s; M[row * 3 + 2] = c / s;
      }
    }
    const hsl = {
      g: [v.lrGreenHue, v.lrGreenSat, v.lrGreenLum], b: [v.lrBlueHue, v.lrBlueSat, v.lrBlueLum], a: [v.lrAquaHue, v.lrAquaSat, v.lrAquaLum],
    };
    // Vinyet
    const vs0 = .18 + .7 * (v.lrVigMid / 100); const vf = v.lrVigFeather / 100; const vs1 = vs0 + (1.15 - vs0) * (.3 + .7 * vf);
    const vAmt = v.lrVigAmount / 100; const vRound = v.lrVigRound / 100; const vHi = v.lrVigHighlights / 100;
    const halfDiag = Math.hypot(w, h) / 2;
    // Gren
    const cell = Math.max(1, Math.round((1 + v.lrGrainSize / 100 * 3) * unit)); const gAmt = v.lrGrainAmount / 100; const gRough = v.lrGrainRough / 100;
    const m1e = v.lrM1Exp; const m2e = v.lrM2Exp; const m3e = v.lrM3Exp; const m4e = v.lrM4Exp; const m5e = v.lrM5Exp;
    const baseEV = v.lrExposure;

    /* 3) Piksel döngüsü */
    const rowsPerChunk = Math.max(16, Math.floor(180000 / w));
    for (let y = 0; y < h; y++) {
      const gy = clamp((y + .5) / f - .5, 0, gh - 1); const gy0 = Math.floor(gy); const gy1 = Math.min(gh - 1, gy0 + 1); const gfy = gy - gy0;
      const row0 = gy0 * gw; const row1 = gy1 * gw;
      const ny = (y + .5) / h; const yUp = Math.max(0, y - 1) * w; const yDn = Math.min(h - 1, y + 1) * w;
      const yT1 = Math.max(0, y - rt) * w; const yT2 = Math.min(h - 1, y + rt) * w; const yS1 = Math.max(0, y - rs) * w; const yS2 = Math.min(h - 1, y + rs) * w;
      const w3 = hasMask[2] ? 1 - sstep(0, .48, ny) : 0; const w5 = hasMask[4] ? sstep(.74, .99, ny) : 0;
      const vy = (y + .5 - h / 2);
      for (let x = 0; x < w; x++) {
        const p = y * w + x; const i = p * 4;
        const r0 = data[i] / 255; const g0 = data[i + 1] / 255; const b0 = data[i + 2] / 255;
        let r = r0; let g = g0; let b = b0;
        const Y0 = L0[p];
        const nx = (x + .5) / w;

        // Bölgesel maskeler
        let ev = baseEV; let clarity = v.lrClarity; let dehaze = v.lrDehaze; let localShadow = 0;
        if (hasMask[0]) { const dx = (nx - .5) / .36; const dy = (ny - .56) / .34; const wm = 1 - sstep(.35, 1.1, dx * dx + dy * dy); ev += wm * m1e; clarity += wm * v.lrM1Clarity; }
        if (hasMask[1]) { const wm = 1 - sstep(.16, .40, Y0); ev += wm * m2e; localShadow = wm * v.lrM2Shadows / 100; }
        if (hasMask[2]) { ev += w3 * m3e; dehaze += w3 * v.lrM3Dehaze; }
        if (hasMask[3]) {
          const mx = Math.max(r0, g0, b0); const sat = mx > 0 ? (mx - Math.min(r0, g0, b0)) / mx : 0;
          const wm = sstep(.5, .78, Y0) * (1 - sstep(.10, .30, sat)); ev += wm * m4e; clarity += wm * v.lrM4Clarity;
        }
        if (hasMask[4]) { ev += w5 * m5e; clarity += w5 * v.lrM5Clarity; }

        // Pozlama (gama uzayında ≈ doğrusal ışık çarpanı)
        if (ev !== 0) { const mult = Math.exp(ev * .3151); r *= mult; g *= mult; b *= mult; }

        // Duman giderme
        if (useDehaze && dehaze !== 0) {
          const dh = clamp(dehaze / 100, -1, 1);
          if (dh > 0) {
            const dc = sample(Dark, row0, row1, gfy, x);
            const t = clamp(1 - dh * .85 * (dc / atm), .45, 1);
            r = (r - atm) / t + atm; g = (g - atm) / t + atm; b = (b - atm) / t + atm;
          } else { const k = -dh * .5; r += (.85 - r) * k; g += (.85 - g) * k; b += (.85 - b) * k; }
        }
        r = clamp(r, 0, 1); g = clamp(g, 0, 1); b = clamp(b, 0, 1);

        // Ton eğrisi: ışık/gölge/parlak/beyaz/siyah/kontrast/parametrik
        {
          const Yc = .2126 * r + .7152 * g + .0722 * b;
          let d = toneLUT[(Yc * 1024) | 0];
          if (localShadow !== 0) d += localShadow * .16 * sstep(0, .12, Yc) * (1 - sstep(.3, .72, Yc));
          r += d; g += d; b += d;
        }

        // Beyaz dengesi / ton
        if (tr !== 0 || tint !== 0) { r += tr; b -= tr; g -= tint; r += tint * .5; b += tint * .5; }
        r = clamp(r, 0, 1); g = clamp(g, 0, 1); b = clamp(b, 0, 1);

        // Kalibrasyon
        if (M) {
          const nr = M[0] * r + M[1] * g + M[2] * b; const ng = M[3] * r + M[4] * g + M[5] * b; const nb = M[6] * r + M[7] * g + M[8] * b;
          r = clamp(nr, 0, 1); g = clamp(ng, 0, 1); b = clamp(nb, 0, 1);
        }
        if (shadowTint !== 0) { const Ys = .2126 * r + .7152 * g + .0722 * b; g -= shadowTint * (1 - Ys) * (1 - Ys); }

        // HSL (yeşil / aqua / mavi)
        if (useHSL) {
          const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const dlt = mx - mn;
          if (dlt > .02) {
            rgb2hsl(r, g, b); const hh = HSL[0]; const gate = sstep(.03, .18, dlt);
            const wg = tri(hh, 120, 55) * gate; const wa = tri(hh, 180, 55) * gate; const wb = tri(hh, 240, 55) * gate;
            if (wg + wa + wb > .001) {
              const dH = (wg * hsl.g[0] + wa * hsl.a[0] + wb * hsl.b[0]) * hueDeg;
              const dS = (wg * hsl.g[1] + wa * hsl.a[1] + wb * hsl.b[1]) / 100;
              const dL = (wg * hsl.g[2] + wa * hsl.a[2] + wb * hsl.b[2]) / 100;
              hsl2rgb(hh + dH, clamp(HSL[1] * (1 + dS), 0, 1), clamp(HSL[2] * (1 + dL * .8), 0, 1));
              r = RGB[0]; g = RGB[1]; b = RGB[2];
            }
          }
        }

        // Canlılık + doygunluk
        if (vibr !== 0 || satG !== 1) {
          const Ys = .2126 * r + .7152 * g + .0722 * b; const mx = Math.max(r, g, b);
          const sp = mx > 0 ? (mx - Math.min(r, g, b)) / mx : 0;
          const k = satG * (1 + vibr * (1 - sp));
          r = Ys + (r - Ys) * k; g = Ys + (g - Ys) * k; b = Ys + (b - Ys) * k;
        }

        // Netlik / doku / keskinleştirme (kaynak parlaklıktan gelen ayrıntı katmanları)
        let detail = 0;
        if (useClarity && clarity !== 0) {
          const dm = Y0 - sample(Lmed, row0, row1, gfy, x); const mid = .35 + .65 * (1 - (2 * Y0 - 1) ** 2);
          detail += dm * (clarity / 100) * .8 * mid;
        }
        const xT1 = Math.max(0, x - rt); const xT2 = Math.min(w - 1, x + rt);
        const xS1 = Math.max(0, x - rs); const xS2 = Math.min(w - 1, x + rs);
        if (useTexture) {
          const mean = (L0[yT1 + xT1] + L0[yT1 + x] + L0[yT1 + xT2] + L0[p - x + xT1] + L0[p - x + xT2] + L0[yT2 + xT1] + L0[yT2 + x] + L0[yT2 + xT2]) / 8;
          const df = Y0 - mean; detail += df * texK * (1 - .6 * sstep(.08, .3, Math.abs(df)));
        }
        if (useSharp) {
          const mean = (L0[yS1 + xS1] + L0[yS1 + x] + L0[yS1 + xS2] + L0[p - x + xS1] + L0[p - x + xS2] + L0[yS2 + xS1] + L0[yS2 + x] + L0[yS2 + xS2]) / 8;
          const ds = Y0 - mean; let edge = 1;
          if (maskAmt > 0) {
            const gx = Math.abs(L0[p - x + Math.min(w - 1, x + 1)] - L0[p - x + Math.max(0, x - 1)]);
            const gyv = Math.abs(L0[yDn + x] - L0[yUp + x]);
            edge = sstep(maskAmt * .05, maskAmt * .05 + .05, gx + gyv);
          }
          detail += ds * sharpK * (detailFrac + (1 - detailFrac) * edge);
        }
        if (detail !== 0) { r += detail; g += detail; b += detail; }

        // Vinyet
        if (useVig) {
          const dxp = x + .5 - w / 2;
          const de = Math.hypot(dxp / (w / 2), vy / (h / 2)) / 1.4142;
          let dist;
          if (vRound >= 0) dist = de + (Math.hypot(dxp, vy) / halfDiag - de) * vRound;
          else dist = de + (Math.max(Math.abs(dxp) / (w / 2), Math.abs(vy) / (h / 2)) - de) * -vRound;
          const wv = sstep(vs0, vs1, dist);
          let mult = 1 + vAmt * 1.6 * wv;
          if (vAmt < 0 && vHi > 0) mult += (1 - mult) * vHi * sstep(.55, 1, Y0);
          r *= mult; g *= mult; b *= mult;
        }

        // Gren
        if (useGrain) {
          const n1 = hash((x / cell) | 0, (y / cell) | 0); const n2 = hash(x, y);
          const n = (n1 * (1 - gRough) + n2 * gRough) * 1.5;
          const Yn = .2126 * r + .7152 * g + .0722 * b;
          const wt = .4 + .6 * (1 - (2 * Yn - 1) ** 2);
          const gv = n * gAmt * .22 * wt; r += gv; g += gv; b += gv;
        }

        if (strength < 1) { r = r0 + (r - r0) * strength; g = g0 + (g - g0) * strength; b = b0 + (b - b0) * strength; }
        data[i] = r <= 0 ? 0 : r >= 1 ? 255 : r * 255 + .5;
        data[i + 1] = g <= 0 ? 0 : g >= 1 ? 255 : g * 255 + .5;
        data[i + 2] = b <= 0 ? 0 : b >= 1 ? 255 : b * 255 + .5;
      }
      if (y % rowsPerChunk === rowsPerChunk - 1) {
        if (isCancelled()) return false;
        if (onProgress) onProgress(Math.round(y / h * 100));
        await tick();
      }
    }
    return true;
  }

  async function apply(canvas, w, h, values, opt) {
    const ctx = canvas.getContext('2d');
    const image = ctx.getImageData(0, 0, w, h);
    const ok = await process(image.data, w, h, values, opt);
    if (!ok) return false;
    ctx.putImageData(image, 0, 0);
    return true;
  }

  /* ---------- Kaydırıcı paneli (index.html içindeki #recipeGroups alanına üretilir) ---------- */
  function buildPanel(container) {
    if (!container || container.dataset.built) return;
    container.dataset.built = '1';
    const row = (it) => {
      const label = document.createElement('label'); label.className = 'slider-row'; label.htmlFor = it.key;
      const span = document.createElement('span'); span.textContent = it.label;
      const out = document.createElement('output'); out.id = `value-${it.key}`; out.textContent = String(it.def); label.append(span, out);
      const input = document.createElement('input'); input.className = 'pro-slider'; input.type = 'range'; input.id = it.key; input.dataset.setting = it.key;
      input.min = String(it.min); input.max = String(it.max); input.step = String(it.step); input.value = String(it.def);
      return [label, input];
    };
    const top = document.createElement('div'); top.className = 'recipe-master'; top.append(...row(STRENGTH)); container.append(top);
    for (const g of GROUPS) {
      const det = document.createElement('details'); det.className = 'recipe-section'; if (g.open) det.open = true;
      const sum = document.createElement('summary'); sum.textContent = g.title; det.append(sum);
      for (const it of g.items) det.append(...row(it));
      container.append(det);
    }
  }

  window.ForgeRecipe = Object.freeze({ DEFAULTS, PRESETS, GROUPS, EFFECT_KEYS, isActive, process, apply, buildPanel });
})();
