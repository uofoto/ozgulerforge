// Format bilgisi, piksel biçimi analizi ve dönüşüm planlayıcı.
// Planlayıcı saf fonksiyondur: ffprobe çıktısı + hedef -> ffmpeg argümanları + dürüst uyarılar.

/* ---------- Piksel biçimi çözümleme ---------- */
export function describePix(fmt) {
  const f = (fmt || '').toLowerCase();
  const d = { fmt: f, cls: 'rgb', depth: 8, alpha: false, yuv: false, float: false, full: /^yuvj/.test(f) };
  if (f === 'pal8') { d.cls = 'pal'; return d; }
  if (/^mono(b|w)$/.test(f)) { d.cls = 'mono'; return d; }
  if (/^ya(8|16)/.test(f)) { d.cls = 'graya'; d.alpha = true; d.depth = f.includes('16') ? 16 : 8; return d; }
  if (/^gray/.test(f)) {
    d.cls = 'gray';
    const m = f.match(/gray(\d+)/); d.depth = m ? Math.min(16, +m[1]) : 8;
    d.float = /f32/.test(f); if (d.float) d.depth = 16;
    return d;
  }
  if (/^(yuv|nv|p0|p2|uyvy|yuyv|yvyu|y2|ayuv|vuy|xv3)/.test(f)) {
    d.yuv = true; d.alpha = /^(yuva|ayuv)/.test(f); d.cls = d.alpha ? 'rgba' : 'rgb';
    const m = f.match(/(?:p|^p0|^p2)(9|10|12|14|16)(?:le|be)?$/) || f.match(/^p[02](10|12|16)/);
    d.depth = m ? (+m[1] > 8 ? 16 : 8) : 8;
    return d;
  }
  d.alpha = /(rgba|bgra|argb|abgr|gbrap)/.test(f);
  d.cls = d.alpha ? 'rgba' : 'rgb';
  d.float = /f32|f16/.test(f);
  if (/(48|64)(le|be)?$/.test(f) || /(gbrap?)(9|10|12|14|16)/.test(f) || d.float) d.depth = 16;
  return d;
}

/* ---------- Giriş türü ---------- */
const STILL_FORMAT = /(_pipe$|^image2|^ico$|^tiff|^bmp|^webp|^jpeg|^png)/;
export function kindOf(info) {
  const v = pickVideo(info);
  const hasAudio = info.streams.some(s => s.type === 'audio');
  if (!v) return hasAudio ? 'audio' : 'unknown';
  const fmt = info.format || '';
  if (fmt === 'apng') return 'animated';
  if (fmt === 'gif') return (info.frameCount || 0) > 1 ? 'animated' : 'image';
  if (STILL_FORMAT.test(fmt) && !hasAudio) return 'image';
  return 'video';
}
export function pickVideo(info) {
  return info.streams.find(s => s.type === 'video' && !s.attached) || null;
}

/* ---------- Resim hedef tabloları ---------- */
const P = (g, ga, rgb, rgba, pal = 'pal8', mono = 'monob') => ({ pal, mono, gray: g, graya: ga, rgb, rgba });
const IMG = {
  png:  P({ 8: 'gray', 16: 'gray16be' }, { 8: 'ya8', 16: 'ya16be' }, { 8: 'rgb24', 16: 'rgb48be' }, { 8: 'rgba', 16: 'rgba64be' }),
  tiff: P({ 8: 'gray', 16: 'gray16le' }, { 8: 'ya8', 16: 'ya16le' }, { 8: 'rgb24', 16: 'rgb48le' }, { 8: 'rgba', 16: 'rgba64le' }),
  pam:  P({ 8: 'gray', 16: 'gray16be' }, { 8: 'ya8', 16: 'ya16be' }, { 8: 'rgb24', 16: 'rgb48be' }, { 8: 'rgba', 16: 'rgba64be' }, 'rgb24'),
  jp2:  P({ 8: 'gray', 16: 'gray16le' }, { 8: 'ya8', 16: 'ya16le' }, { 8: 'rgb24', 16: 'rgb48le' }, { 8: 'rgba', 16: 'rgba64le' }, 'pal8', 'gray'),
  bmp:  P({ 8: 'gray' }, { 8: 'bgra' }, { 8: 'bgr24' }, { 8: 'bgra' }),
  tga:  P({ 8: 'gray' }, { 8: 'bgra' }, { 8: 'bgr24' }, { 8: 'bgra' }, 'pal8', 'gray'),
  qoi:  P({ 8: 'rgb24' }, { 8: 'rgba' }, { 8: 'rgb24' }, { 8: 'rgba' }, 'rgb24', 'rgb24'),
  webp: P({ 8: 'bgra' }, { 8: 'bgra' }, { 8: 'bgra' }, { 8: 'bgra' }, 'bgra', 'bgra'),
};
function imagePix(desc, table) {
  const t = table[desc.cls];
  if (typeof t === 'string') return { pix: t, exact: true };
  if (t[desc.depth]) return { pix: t[desc.depth], exact: !desc.float };
  return { pix: t[8], exact: false, narrowed: true };
}

/* ---------- Hedef listesi ---------- */
// group: image | video | anim | frames
export const TARGETS = [
  { id: 'png',  group: 'image', label: 'PNG', ext: 'png', mime: 'image/png', lossless: true, enc: ['png'], hint: 'Evrensel, 16 bit ve saydamlık destekler' },
  { id: 'webp', group: 'image', label: 'WebP', ext: 'webp', mime: 'image/webp', lossless: true, enc: ['libwebp'], hint: 'Kayıpsız mod, yalnız 8 bit' },
  { id: 'tiff', group: 'image', label: 'TIFF', ext: 'tiff', mime: 'image/tiff', lossless: true, enc: ['tiff'], hint: '16 bit destekli, arşiv için' },
  { id: 'jp2',  group: 'image', label: 'JPEG 2000', ext: 'jp2', mime: 'image/jp2', lossless: true, enc: ['jpeg2000'], hint: 'Tersinir 5/3 dalgacık' },
  { id: 'bmp',  group: 'image', label: 'BMP', ext: 'bmp', mime: 'image/bmp', lossless: true, enc: ['bmp'], hint: 'Ham, yalnız 8 bit' },
  { id: 'qoi',  group: 'image', label: 'QOI', ext: 'qoi', mime: 'image/qoi', lossless: true, enc: ['qoi'], hint: 'Çok hızlı, 8 bit' },
  { id: 'pam',  group: 'image', label: 'PAM (Netpbm)', ext: 'pam', mime: 'image/x-portable-arbitrarymap', lossless: true, enc: ['pam'], hint: 'Sade ham format, 16 bit destekli' },
  { id: 'tga',  group: 'image', label: 'TGA', ext: 'tga', mime: 'image/x-tga', lossless: true, enc: ['targa'], hint: '8 bit' },
  { id: 'jpg',  group: 'image', label: 'JPEG', ext: 'jpg', mime: 'image/jpeg', lossless: false, enc: ['mjpeg'], hint: 'Her zaman kayıplı' },
  { id: 'gif',  group: 'image', label: 'GIF', ext: 'gif', mime: 'image/gif', lossless: false, enc: ['gif'], hint: '256 renk sınırı' },

  { id: 'mkv-ffv1', group: 'video', label: 'MKV · FFV1', ext: 'mkv', mime: 'video/x-matroska', lossless: true, enc: ['ffv1'], hint: 'Arşiv standardı, tüm piksel biçimleri' },
  { id: 'avi-ffv1', group: 'video', label: 'AVI · FFV1', ext: 'avi', mime: 'video/x-msvideo', lossless: true, enc: ['ffv1'], hint: 'FFV1 + PCM ses' },
  { id: 'mp4-h264', group: 'video', label: 'MP4 · H.264', ext: 'mp4', mime: 'video/mp4', lossless: true, enc: ['libx264'], hint: 'qp 0; yalnız VLC/mpv gibi oynatıcılarda kesin çalışır' },
  { id: 'mov-h264', group: 'video', label: 'MOV · H.264', ext: 'mov', mime: 'video/quicktime', lossless: true, enc: ['libx264'], hint: 'qp 0 + ALAC/PCM ses' },
  { id: 'mkv-h264', group: 'video', label: 'MKV · H.264', ext: 'mkv', mime: 'video/x-matroska', lossless: true, enc: ['libx264'], hint: 'FFV1\'den küçük, daha az uyumlu' },
  { id: 'webm-vp9', group: 'video', label: 'WebM · VP9', ext: 'webm', mime: 'video/webm', lossless: true, enc: ['libvpx-vp9'], hint: 'Görüntü kayıpsız; ses yalnız Opus/Vorbis', unstable: 'Bu ffmpeg.wasm derlemesinde VP9 kodlayıcı birkaç kareden sonra çöküyor (test edildi). WebM dosyalarını girdi olarak okuyabilirsiniz; kayıpsız çıktı için MKV · FFV1 kullanın.' },

  { id: 'apng', group: 'anim', label: 'APNG', ext: 'png', mime: 'image/apng', lossless: true, enc: ['apng'], hint: 'Kayıpsız hareketli PNG' },
  { id: 'webp-anim', group: 'anim', label: 'WebP animasyon', ext: 'webp', mime: 'image/webp', lossless: true, enc: ['libwebp_anim'], hint: '8 bit; ffmpeg geri okuyamaz, doğrulanamaz' },
  { id: 'gif-anim', group: 'anim', label: 'GIF animasyon', ext: 'gif', mime: 'image/gif', lossless: false, enc: ['gif'], hint: '256 renk sınırı' },

  { id: 'frames-png', group: 'frames', label: 'Kareler · PNG (ZIP)', ext: 'zip', mime: 'application/zip', lossless: true, enc: ['png'], hint: 'Her kare ayrı PNG' },
  { id: 'frames-tiff', group: 'frames', label: 'Kareler · TIFF (ZIP)', ext: 'zip', mime: 'application/zip', lossless: true, enc: ['tiff'], hint: 'Her kare ayrı TIFF' },
];
export const GROUPS = {
  image: 'Resim', video: 'Video', anim: 'Hareketli resim', frames: 'Kare dizisi',
};
export const byId = Object.fromEntries(TARGETS.map(t => [t.id, t]));

export function targetAllowed(kind, t) {
  if (kind === 'image') return t.group === 'image';
  if (kind === 'animated') return t.group !== 'image';
  if (kind === 'video') return t.group !== 'image';
  return false;
}
export function missingEncoders(t, caps) {
  if (t.unstable) return [];
  return t.enc.filter(e => !caps.encoders.has(e));
}

/* ---------- Ses ---------- */
const LOSSLESS_AUDIO = /^(flac|alac|wavpack|ape|tta|truehd|mlp|shorten|wmalossless|pcm_(?!f|alaw|mulaw))/;
const PCM_ANY = /^pcm_/;
const COPY = {
  mkv: () => true,
  mp4: c => ['aac', 'mp3', 'ac3', 'eac3', 'alac', 'mp2', 'opus', 'flac'].includes(c),
  mov: c => ['aac', 'mp3', 'ac3', 'eac3', 'alac', 'mp2'].includes(c) || PCM_ANY.test(c),
  avi: c => ['mp3', 'mp2', 'ac3', 'aac', 'pcm_s16le', 'pcm_s24le', 'pcm_s32le', 'pcm_u8', 'pcm_f32le'].includes(c),
  webm: c => ['vorbis', 'opus'].includes(c),
};
function pcmFor(a) {
  const f = a.sampleFmt || '', bits = a.bits || 0;
  if (/^flt|^dbl/.test(f)) return 'pcm_f32le';
  if (/^u8/.test(f)) return 'pcm_u8';
  if (/^s16/.test(f) && !(bits > 16)) return 'pcm_s16le';
  if (bits === 24 || (/^s32/.test(f) && bits === 24)) return 'pcm_s24le';
  if (/^s32/.test(f) && bits && bits < 24) return 'pcm_s24le';
  if (/^s32/.test(f)) return 'pcm_s32le';
  return 'pcm_s16le';
}
function audioPlan(a, container) {
  if (COPY[container](a.codec)) return { copy: true, exact: true };
  const losslessSrc = LOSSLESS_AUDIO.test(a.codec);
  if (container === 'webm') {
    const kbps = Math.min(510, Math.max(96, 96 * (a.channels || 2)));
    return { args: ['libopus', '-b:a', kbps + 'k'], exact: false, note: `Ses (${a.codec}) WebM'e sığmaz; Opus ${kbps} kb/s ile yeniden kodlandı (kayıplı).` };
  }
  if (container === 'avi') {
    const c = pcmFor(a);
    return { args: [c], exact: losslessSrc || PCM_ANY.test(a.codec), note: `Ses (${a.codec}) AVI'ye sığmaz; ${c} olarak yazıldı.` };
  }
  // mp4 / mov
  const fl = /^(flt|dbl)/.test(a.sampleFmt || '');
  return {
    args: ['alac'], exact: losslessSrc && !fl,
    note: `Ses (${a.codec}) bu kapsayıcıya sığmaz; ALAC (kayıpsız) olarak yazıldı.` +
      (losslessSrc && !fl ? '' : ' Kaynak kayıplı/float olduğu için bit-bit eşitlik garanti edilmez.'),
  };
}

/* ---------- Video piksel biçimi seçimleri ---------- */
const FFV1_SET = new Set(['yuv420p', 'yuva420p', 'yuva422p', 'yuv444p', 'yuva444p', 'yuv440p', 'yuv422p', 'yuv411p', 'yuv410p',
  'gray', 'gray9le', 'gray10le', 'gray12le', 'gray14le', 'gray16le', 'gbrp', 'gbrap', 'bgr0', 'bgra',
  'yuv420p9le', 'yuv420p10le', 'yuv420p12le', 'yuv420p14le', 'yuv420p16le', 'yuv422p9le', 'yuv422p10le', 'yuv422p12le', 'yuv422p14le', 'yuv422p16le',
  'yuv444p9le', 'yuv444p10le', 'yuv444p12le', 'yuv444p14le', 'yuv444p16le', 'gbrp9le', 'gbrp10le', 'gbrp12le', 'gbrp14le', 'gbrp16le',
  'gbrap10le', 'gbrap12le', 'gbrap16le', 'yuva420p9le', 'yuva420p10le', 'yuva420p16le', 'yuva422p9le', 'yuva422p10le', 'yuva422p16le',
  'yuva444p9le', 'yuva444p10le', 'yuva444p16le']);
const FFV1_MAP = { yuvj420p: 'yuv420p', yuvj422p: 'yuv422p', yuvj444p: 'yuv444p', yuvj440p: 'yuv440p', nv12: 'yuv420p', nv21: 'yuv420p', nv16: 'yuv422p',
  p010le: 'yuv420p10le', uyvy422: 'yuv422p', yuyv422: 'yuv422p', rgb24: 'bgr0', bgr24: 'bgr0', rgb0: 'bgr0', '0rgb': 'bgr0', '0bgr': 'bgr0',
  rgba: 'bgra', argb: 'bgra', abgr: 'bgra', pal8: 'bgra', rgb48le: 'gbrp16le', rgb48be: 'gbrp16le', bgr48le: 'gbrp16le', rgba64le: 'gbrap16le', rgba64be: 'gbrap16le' };
function ffv1Pix(f) {
  if (FFV1_SET.has(f)) return { pix: f, exact: true };
  if (FFV1_MAP[f]) return { pix: FFV1_MAP[f], exact: true, rangeFix: /^yuvj/.test(f) };
  return { pix: 'bgr0', exact: false, note: `Piksel biçimi ${f} FFV1'e doğrudan yazılamıyor; RGB'ye çevrildi.` };
}
const X264_8 = new Set(['yuv420p', 'yuvj420p', 'yuv422p', 'yuvj422p', 'yuv444p', 'yuvj444p', 'nv12', 'nv16', 'nv21', 'gray']);
const X264_10 = new Set(['yuv420p10le', 'yuv422p10le', 'yuv444p10le', 'gray10le']);
function x264Pix(f, d, caps) {
  if (X264_8.has(f)) return { pix: f, exact: true };
  if (X264_10.has(f)) {
    if (!caps.x264_10) return { error: 'Bu ffmpeg derlemesi 10 bit H.264 kodlayamıyor. MKV · FFV1 seçin.' };
    return { pix: f, exact: true };
  }
  if (!d.yuv && /^(rgb24|bgr24|bgr0|gbrp)$/.test(f) && caps.encoders.has('libx264rgb')) {
    return { pix: f === 'gbrp' ? 'rgb24' : f, exact: true, rgb: true, note: 'RGB kaynak olduğu için libx264rgb kullanıldı; bazı oynatıcılar renkleri yanlış gösterebilir.' };
  }
  if (d.depth > 8) return { error: 'Bu piksel biçimi H.264 ile kayıpsız yazılamıyor. MKV · FFV1 seçin.' };
  return { pix: d.alpha ? 'yuv444p' : (d.yuv ? 'yuv444p' : 'yuv444p'), exact: false,
    note: `Piksel biçimi ${f} H.264'e doğrudan yazılamıyor (RGB/alfa); YUV 4:4:4'e çevrildi, bu adım kayıplıdır.` };
}
const VP9_SET = new Set(['yuv420p', 'yuva420p', 'yuv422p', 'yuv440p', 'yuv444p', 'gbrp', 'yuv420p10le', 'yuv422p10le', 'yuv440p10le', 'yuv444p10le', 'gbrp10le', 'yuv420p12le', 'yuv422p12le', 'yuv444p12le', 'gbrp12le']);
function vp9Pix(f, d, caps) {
  let pix = f, exact = true, note;
  if (!VP9_SET.has(f)) {
    if (/^(nv12|nv21)$/.test(f)) pix = 'yuv420p';
    else if (/^yuvj(420|422|444|440)p$/.test(f)) pix = f.replace('yuvj', 'yuv');
    else if (/^(rgb24|bgr24|bgr0|rgb0)$/.test(f)) pix = 'gbrp';
    else { pix = d.alpha ? 'yuva420p' : 'yuv444p'; exact = false; note = `Piksel biçimi ${f} VP9'a doğrudan yazılamıyor; dönüştürüldü (kayıplı).`; }
  }
  if (/10le|12le/.test(pix) && !caps.vp9_10) return { error: 'Bu ffmpeg derlemesi 10 bit VP9 kodlayamıyor. MKV · FFV1 seçin.' };
  if (/^(yuv422p|yuv440p|yuv444p|gbrp)/.test(pix) && !caps.vp9_444) return { error: 'Bu ffmpeg derlemesi 4:2:2/4:4:4 VP9 kodlayamıyor. MKV · FFV1 seçin.' };
  return { pix, exact, note, rangeFix: /^yuvj/.test(f) };
}

/* ---------- Çabalar ---------- */
const EFFORT = {
  png: { fast: 1, balanced: 6, small: 9 },
  webp: { fast: ['0', '40'], balanced: ['4', '75'], small: ['6', '100'] },
  x264: { fast: 'ultrafast', balanced: 'veryfast', small: 'slow' },
  vp9: { fast: '8', balanced: '6', small: '5' }, // wasm derlemesinde 'good' kipi ve kareler arası tahmin çöküyor; yalnız realtime + her kare anahtar kare çalışır
};

/* ---------- Ana planlayıcı ---------- */
// ctx: { inPath, outPath, caps, effort }
export function plan(info, kind, t, ctx) {
  const v = pickVideo(info);
  if (!v) return { error: 'Görüntü akışı bulunamadı.' };
  if (t.unstable) return { error: t.unstable };
  if (!targetAllowed(kind, t)) return { error: 'Bu hedef bu dosya türüyle kullanılamaz.' };
  const miss = missingEncoders(t, ctx.caps);
  if (miss.length) return { error: `Bu ffmpeg derlemesinde kodlayıcı yok: ${miss.join(', ')}` };
  const d = describePix(v.pixFmt);
  const effort = ctx.effort || 'balanced';
  const pass = ctx.caps.ver >= 5.1 ? ['-fps_mode', 'passthrough'] : ['-vsync', '0'];
  const res = { exact: t.lossless, notes: [], warnings: [], target: t };

  if (t.group === 'image') return planImage(info, v, d, t, ctx, effort, res);
  if (t.group === 'video') return planVideo(info, v, d, t, ctx, effort, pass, res);
  return planAnim(info, v, d, t, ctx, effort, pass, res);
}

function imageEncArgs(t, effort) {
  switch (t.id) {
    case 'png': case 'apng': case 'frames-png':
      return ['-c:v', t.id === 'apng' ? 'apng' : 'png', '-compression_level', String(EFFORT.png[effort]), ...(effort === 'small' ? ['-pred', 'mixed'] : [])];
    case 'tiff': case 'frames-tiff': return ['-c:v', 'tiff', '-compression_algo', effort === 'fast' ? 'lzw' : 'deflate'];
    case 'webp': { const [cl, q] = EFFORT.webp[effort]; return ['-c:v', 'libwebp', '-lossless', '1', '-compression_level', cl, '-quality', q]; }
    case 'webp-anim': { const [cl, q] = EFFORT.webp[effort]; return ['-c:v', 'libwebp_anim', '-lossless', '1', '-compression_level', cl, '-quality', q, '-loop', '0']; }
    case 'jp2': return ['-c:v', 'jpeg2000', '-pred', '1'];
    case 'bmp': return ['-c:v', 'bmp'];
    case 'qoi': return ['-c:v', 'qoi'];
    case 'pam': return ['-c:v', 'pam'];
    case 'tga': return ['-c:v', 'targa'];
    case 'jpg': return ['-c:v', 'mjpeg', '-q:v', '1', '-huffman', 'optimal'];
    default: return [];
  }
}

function planImage(info, v, d, t, ctx, effort, res) {
  if (t.id === 'jp2' && d.depth > 8) return { error: 'Bu ffmpeg çekirdeğinde 16 bit JPEG 2000 kayıpsız değil (doğrulamada fark çıktı). PNG veya TIFF seçin.' };
  const args = ['-noautorotate', '-i', ctx.inPath, '-map', '0:' + v.index, '-frames:v', '1', '-an', '-sn', '-dn'];
  let pix;
  if (t.id === 'jpg') {
    pix = 'yuvj444p'; res.exact = false;
    res.warnings.push('JPEG kayıplıdır: yüksek kalitede (q=1) yazılır ama bit-bit aynı olmaz.');
    args.push(...imageEncArgs(t, effort), '-pix_fmt', pix);
  } else if (t.id === 'gif') {
    res.exact = d.cls === 'pal';
    if (!res.exact) res.warnings.push('GIF en fazla 256 renk tutar; renk sayısı fazlaysa görüntü nicemlenir (kayıplı).');
    args.push('-vf', 'split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse', '-c:v', 'gif');
  } else {
    const r = imagePix(d, IMG[t.id]);
    pix = r.pix;
    if (!r.exact) {
      res.exact = false;
      res.warnings.push(r.narrowed ? `${t.label} ${d.depth} bit desteklemez; 8 bite indirildi (kayıplı).` : 'Kayan nokta kaynak tamsayıya çevrildi (kayıplı).');
    }
    if (t.id === 'webp' && (v.width > 16383 || v.height > 16383)) return { error: 'WebP en fazla 16383 piksel destekler.' };
    if (d.yuv) res.notes.push('Kaynak YUV; çözülmüş RGB görüntü birebir saklanır (kaynağın kendi sıkıştırma kaybı geri gelmez).');
    args.push(...imageEncArgs(t, effort), '-pix_fmt', pix);
  }
  args.push(...(t.id === 'webp' ? ['-f', 'webp'] : ['-f', 'image2', '-update', '1']), ctx.outPath);
  res.args = args;
  res.verify = res.exact && pix ? { v: { index: v.index, pix } } : { skip: res.exact ? '' : 'Kayıplı hedef; bit-bit karşılaştırma yapılmadı.' };
  res.summary = `${t.label}${pix ? ' · ' + pix : ''}`;
  return res;
}

function planAnim(info, v, d, t, ctx, effort, pass, res) {
  const isFrames = t.group === 'frames';
  const args = ['-noautorotate', '-i', ctx.inPath, '-map', '0:' + v.index, '-an', '-sn', '-dn', ...pass];
  let pix = null;
  if (t.id === 'gif-anim') {
    res.exact = d.cls === 'pal';
    res.warnings.push('GIF en fazla 256 renk tutar; renkli video/animasyonlarda kayıplıdır.');
    args.push('-vf', 'split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse', '-c:v', 'gif', '-loop', '0', '-f', 'gif');
  } else {
    const table = (t.id === 'frames-tiff') ? IMG.tiff : (t.id === 'webp-anim' ? IMG.webp : IMG.png);
    const r = imagePix(d, table);
    pix = r.pix;
    if (!r.exact) { res.exact = false; res.warnings.push(r.narrowed ? `${t.label} ${d.depth} bit desteklemez; 8 bite indirildi (kayıplı).` : 'Kayan nokta kaynak tamsayıya çevrildi (kayıplı).'); }
    if (t.id === 'webp-anim' && (v.width > 16383 || v.height > 16383)) return { error: 'WebP en fazla 16383 piksel destekler.' };
    if (d.yuv) res.notes.push('Kaynak YUV; çözülmüş RGB kareler birebir saklanır.');
    args.push(...imageEncArgs(t, effort), '-pix_fmt', pix);
    if (t.id === 'apng') args.push('-plays', '0', '-f', 'apng');
    if (t.id === 'webp-anim') args.push('-f', 'webp');
  }
  if (isFrames) args.push('-f', 'image2');
  args.push(ctx.outPath);
  res.args = args; res.frames = isFrames;
  if (!res.exact) res.verify = { skip: 'Kayıplı hedef; bit-bit karşılaştırma yapılmadı.' };
  else if (t.id === 'webp-anim') res.verify = { skip: 'ffmpeg hareketli WebP\'i çözemediği için bu çıktı doğrulanamaz.' };
  else res.verify = { v: { index: v.index, pix }, frames: isFrames };
  res.summary = `${t.label}${pix ? ' · ' + pix : ''}`;
  if (info.streams.some(s => s.type === 'audio')) res.notes.push('Ses bu hedefe aktarılmaz.');
  return res;
}

function planVideo(info, v, d, t, ctx, effort, pass, res) {
  const container = t.ext; // mkv | avi | mp4 | mov | webm
  const codec = t.enc[0];
  let px, vArgs, rangeFix = false;
  if (codec === 'ffv1') {
    px = ffv1Pix(v.pixFmt);
    vArgs = ['-c:v', 'ffv1', '-level', '3', '-coder', '1', '-context', '1', '-g', '1', '-slicecrc', '1'];
  } else if (codec === 'libx264') {
    px = x264Pix(v.pixFmt, d, ctx.caps);
    if (px.error) return { error: px.error };
    vArgs = [...(px.rgb ? ['-c:v', 'libx264rgb'] : ['-c:v', 'libx264']), '-qp', '0', '-preset', EFFORT.x264[effort]];
  } else {
    px = vp9Pix(v.pixFmt, d, ctx.caps);
    if (px.error) return { error: px.error };
    vArgs = ['-c:v', 'libvpx-vp9', '-lossless', '1', '-deadline', 'realtime', '-cpu-used', EFFORT.vp9[effort], '-g', '1', '-threads', '1'];
  }
  rangeFix = !!px.rangeFix;
  if (!px.exact) { res.exact = false; res.warnings.push(px.note || 'Piksel biçimi dönüştürüldü (kayıplı).'); }
  else if (px.note) res.notes.push(px.note);
  if (v.pixFmt !== px.pix && px.exact) res.notes.push(`Piksel biçimi ${v.pixFmt} → ${px.pix} (veri kaybı yok).`);

  const aud = info.streams.filter(s => s.type === 'audio');
  const audPlans = aud.map(a => audioPlan(a, container));
  audPlans.forEach(p => { if (!p.exact) res.exact = false; if (p.note) (p.exact ? res.notes : res.warnings).push(p.note); });

  const subs = info.streams.filter(s => s.type === 'subtitle');
  const TEXT = /^(subrip|srt|ass|ssa|webvtt|mov_text|text)$/;
  const subPlans = [];
  if (container === 'mkv') subs.forEach(s => subPlans.push({ s, codec: s.codec === 'mov_text' ? 'srt' : 'copy' }));
  else if (container === 'mp4' || container === 'mov') subs.filter(s => TEXT.test(s.codec)).forEach(s => subPlans.push({ s, codec: 'mov_text' }));
  const dropped = subs.length - subPlans.length;
  if (dropped > 0) res.warnings.push(`${dropped} altyazı akışı bu kapsayıcıya aktarılmadı.`);

  const build = withSubs => {
    const a = ['-noautorotate', '-i', ctx.inPath, '-map', '0:' + v.index];
    aud.forEach(s => a.push('-map', '0:' + s.index));
    if (withSubs) subPlans.forEach(p => a.push('-map', '0:' + p.s.index));
    a.push('-dn', ...vArgs, '-pix_fmt', px.pix);
    if (rangeFix) a.push('-vf', 'scale=in_range=full:out_range=full');
    audPlans.forEach((p, k) => a.push(...(p.copy ? ['-c:a:' + k, 'copy'] : ['-c:a:' + k, ...p.args])));
    if (withSubs) subPlans.forEach((p, k) => a.push('-c:s:' + k, p.codec));
    a.push('-map_metadata', '0', '-map_chapters', '0', ...pass);
    if (container === 'mp4' || container === 'mov') a.push('-strict', '-2');
    if (container === 'mp4') a.push('-movflags', '+faststart');
    a.push('-f', { mkv: 'matroska', avi: 'avi', mp4: 'mp4', mov: 'mov', webm: 'webm' }[container], ctx.outPath);
    return a;
  };
  res.args = build(true);
  res.fallbackArgs = subPlans.length ? build(false) : null;
  res.verify = res.exact ? {
    v: rangeFix
      ? { index: v.index, srcPix: v.pixFmt, outPix: v.pixFmt, outVf: 'scale=in_range=full:out_range=full' }
      : { index: v.index, pix: px.pix },
    audio: aud.map((s, k) => ({ k, srcIndex: s.index, copy: audPlans[k].copy })).filter(x => !x.copy),
  } : { skip: 'Kayıplı adım içerdiği için bit-bit karşılaştırma yapılmadı.' };
  res.summary = `${t.label} · ${px.pix}${aud.length ? ' · ses: ' + audPlans.map(p => p.copy ? 'kopya' : p.args[0]).join(', ') : ''}`;
  return res;
}
