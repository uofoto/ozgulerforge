// Kamerayla QR okuma.
//
// 1) Tarayıcının yerleşik BarcodeDetector'ı varsa o kullanılır
//    (Android Chrome, macOS Chrome, ChromeOS ...).
// 2) Yoksa vendor/jsQR.js dosyası aranır. Bu dosya depoda YOKTUR; isterseniz
//    jsQR'ın (Apache-2.0) dist/jsQR.js dosyasını vendor/ klasörüne koyun.
// 3) İkisi de yoksa 'unsupported' hatası fırlatılır; arayüz kodu
//    kopyala-yapıştır yoluna yönlendirir.

let jsqrPromise = null;

function loadJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  jsqrPromise ??= new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'vendor/jsQR.js';
    s.onload = () => resolve(window.jsQR || null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return jsqrPromise;
}

export async function scanAvailable() {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  if ('BarcodeDetector' in window) return true;
  return !!(await loadJsQR());
}

// onCode(metin) true dönerse tarama biter, false dönerse sürer.
// Dönen fonksiyon taramayı elle durdurur.
export async function startScan(video, onCode) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');

  let detector = null;
  let jsqr = null;
  if ('BarcodeDetector' in window) {
    try { detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch {}
  }
  if (!detector) {
    jsqr = await loadJsQR();
    if (!jsqr) throw new Error('unsupported');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  });
  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  video.hidden = false;
  await video.play();

  let alive = true;
  const stop = () => {
    alive = false;
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    video.hidden = true;
  };

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let last = '';

  const tick = async () => {
    if (!alive) return;
    try {
      if (video.readyState >= 2 && video.videoWidth) {
        let text = null;
        if (detector) {
          const found = await detector.detect(video);
          if (found.length) text = found[0].rawValue;
        } else {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const hit = jsqr(img.data, img.width, img.height);
          if (hit) text = hit.data;
        }
        if (text && text !== last) {
          last = text;
          if (onCode(text)) return stop();
        }
      }
    } catch {}
    if (alive) setTimeout(tick, 150);
  };
  tick();
  return stop;
}
