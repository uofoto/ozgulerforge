import QRCode from './vendor/qrcode-generator.js';

// Metni SVG QR koda çevirir. Önce "M" (daha dayanıklı) denenir; kod çok
// büyükse "L" düzeyine inilir. QR her zaman siyah-beyaz çizilir, böylece
// karanlık temada da okunur.
export function qrSvg(text) {
  let q = make(text, 0);
  if (q.typeNumber > 22) q = make(text, 1);
  const n = q.getModuleCount();
  const quiet = 4;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (q.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  const size = n + quiet * 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="QR kod">` +
    `<rect width="${size}" height="${size}" fill="#fff"/>` +
    `<path d="${d}" fill="#000"/></svg>`
  );
}

function make(text, level) {
  const q = new QRCode(-1, level);
  q.addData(text);
  q.make();
  return q;
}
