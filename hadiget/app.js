import { Peer } from './peer.js';
import { qrSvg } from './qr.js';
import { startScan, scanAvailable } from './scan.js';
import { parseCode } from './signal.js';

const $ = (s) => document.querySelector(s);
const VIEWS = ['home', 'host', 'join', 'live'];

let peer = null;
let stopScan = null;
let wakeLock = null;
let pendingOffer = null; // ilk bilgiyi alan taraf için bekleyen cevap kodu

// --- küçük yardımcılar ---------------------------------------------------

function show(name) {
  stopCamera();
  VIEWS.forEach((v) => ($('#v-' + v).hidden = v !== name));
  clearError();
  window.scrollTo(0, 0);
}

function showError(msg) {
  const el = $('#error');
  el.textContent = msg;
  el.hidden = false;
}
function clearError() {
  $('#error').hidden = true;
}

function stopCamera() {
  if (stopScan) {
    stopScan();
    stopScan = null;
  }
}

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  const u = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  do {
    n /= 1024;
    i++;
  } while (n >= 1024 && i < u.length - 1);
  return n.toFixed(n < 10 ? 1 : 0) + ' ' + u[i];
}

function safeName(name) {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_') || 'dosya';
}

async function copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  const old = btn.textContent;
  btn.textContent = 'Kopyalandı';
  setTimeout(() => (btn.textContent = old), 1500);
}

function isLocalHost() {
  return ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.protocol === 'file:';
}

// QR içine, telefonun kamera uygulamasının açabileceği tam adres konur.
// Yerel geliştirme adresi başka cihazdan açılamayacağı için o durumda çıplak kod konur.
function qrPayload(code) {
  if (code.startsWith('o.') && !isLocalHost()) return location.href.split('#')[0] + '#' + code;
  return code;
}

function makePeer() {
  try {
    localStorage.setItem('stun', $('#opt-stun').checked ? '1' : '0');
  } catch {}
  return new Peer({
    stun: $('#opt-stun').checked,
    onOpen: goLive,
    onClose: onLost,
    onIncoming: onIncoming,
    onProgress: onProgress,
    onFile: onFile,
    onError: onTransferError,
    onText: onText,
  });
}

function dropPeer() {
  peer?.close();
  peer = null;
  pendingOffer = null;
}

// --- ana ekran -----------------------------------------------------------

try {
  $('#opt-stun').checked = localStorage.getItem('stun') === '1';
} catch {}

$('#btn-host').onclick = startHost;
$('#btn-join').onclick = () => {
  show('join');
  resetJoin();
};
document.querySelectorAll('.back').forEach((b) => {
  b.onclick = () => {
    dropPeer();
    show('home');
  };
});

// --- başlatan cihaz ------------------------------------------------------

async function startHost() {
  dropPeer();
  show('host');
  $('#host-qr').innerHTML = '';
  $('#host-code').value = '';
  $('#host-answer').value = '';
  $('#host-status').textContent = 'Kod hazırlanıyor…';
  peer = makePeer();
  try {
    const code = await peer.createOffer();
    $('#host-code').value = code;
    $('#host-qr').innerHTML = qrSvg(qrPayload(code));
    $('#host-status').textContent = 'Diğer cihazda “Bağlantıya katıl”ı seçip bu kodu okut.';
  } catch (e) {
    showError(e.message || String(e));
  }
}

$('#host-copy').onclick = (e) => copy($('#host-code').value, e.target);

$('#host-scan').onclick = async () => {
  clearError();
  stopCamera();
  try {
    stopScan = await startScan($('#host-video'), (text) => {
      const c = parseCode(text);
      if (c && c.kind === 'a') {
        $('#host-answer').value = c.code;
        finishHost();
        return true;
      }
      return false;
    });
  } catch (e) {
    cameraError(e);
  }
};

$('#host-connect').onclick = finishHost;

async function finishHost() {
  clearError();
  const c = parseCode($('#host-answer').value);
  if (!c) return showError('Cevap kodu geçersiz. Diğer cihazın gösterdiği kodu eksiksiz yapıştır.');
  if (c.kind !== 'a') return showError('Bu bir bağlantı kodu; burada diğer cihazın cevap kodu gerekiyor.');
  try {
    $('#host-status').textContent = 'Bağlanılıyor…';
    await peer.acceptAnswer(c.code);
    armTimeout();
  } catch (e) {
    showError(e.message || String(e));
  }
}

// Bağlantı kurulamazsa kullanıcıyı sonsuza dek bekletme.
let connTimer = null;
function armTimeout() {
  clearTimeout(connTimer);
  const p = peer;
  connTimer = setTimeout(() => {
    if (peer === p && $('#v-live').hidden) {
      showError('Bağlanılamadı. İki cihaz aynı ağda mı? Değilse ana ekrandaki “Farklı ağlardayız” seçeneğini aç ve baştan dene.');
    }
  }, 20000);
}

// --- katılan cihaz -------------------------------------------------------

function resetJoin() {
  $('#join-step1').hidden = false;
  $('#join-step2').hidden = true;
  $('#join-offer').value = '';
  $('#join-qr').innerHTML = '';
  $('#join-code').value = '';
}

$('#join-scan').onclick = async () => {
  clearError();
  stopCamera();
  try {
    stopScan = await startScan($('#join-video'), (text) => {
      const c = parseCode(text);
      if (c && c.kind === 'o') {
        $('#join-offer').value = c.code;
        doJoin(c.code);
        return true;
      }
      return false;
    });
  } catch (e) {
    cameraError(e);
  }
};

$('#join-go').onclick = () => {
  const c = parseCode($('#join-offer').value);
  if (!c) return showError('Kod geçersiz. Diğer cihazın gösterdiği kodu eksiksiz yapıştır.');
  if (c.kind !== 'o') return showError('Bu bir cevap kodu; burada diğer cihazın bağlantı kodu gerekiyor.');
  doJoin(c.code);
};

$('#join-copy').onclick = (e) => copy($('#join-code').value, e.target);

async function doJoin(offerCode) {
  clearError();
  stopCamera();
  dropPeer();
  $('#join-step1').hidden = true;
  $('#join-step2').hidden = false;
  $('#join-qr').innerHTML = '';
  $('#join-status').textContent = 'Cevap hazırlanıyor…';
  peer = makePeer();
  try {
    const answer = await peer.acceptOffer(offerCode);
    $('#join-code').value = answer;
    $('#join-qr').innerHTML = qrSvg(qrPayload(answer));
    $('#join-status').textContent = 'Diğer cihazda “Cevap QR kodunu kamerayla oku”ya basıp bunu okut.';
    armTimeout();
  } catch (e) {
    $('#join-step1').hidden = false;
    $('#join-step2').hidden = true;
    showError(e.message || String(e));
  }
}

function cameraError(e) {
  if (e && e.message === 'unsupported') {
    showError('Bu tarayıcı QR okumayı desteklemiyor. Kodu kopyalayıp diğer cihaza yapıştır ya da telefonun kamera uygulamasıyla oku.');
  } else if (e && e.name === 'NotAllowedError') {
    showError('Kamera izni verilmedi. Tarayıcı ayarlarından izin ver ya da kodu yapıştır.');
  } else {
    showError('Kamera açılamadı. Kodu yapıştırarak devam edebilirsin.');
  }
}

// Kamera ya da QR okuma yoksa düğmeyi gizle, yapıştırma yolu kalsın.
scanAvailable().then((ok) => {
  if (!ok) {
    $('#host-scan').hidden = true;
    $('#join-scan').hidden = true;
  }
});

// Telefonun kamerasından adresle açıldıysa doğrudan katıl.
(function autoJoin() {
  const c = parseCode(location.hash);
  if (!c) return;
  history.replaceState(null, '', location.pathname + location.search);
  if (c.kind !== 'o') {
    showError('Bu bir cevap kodu. Bağlantıyı başlatan cihazda “Cevap QR kodunu kamerayla oku”ya basıp okut.');
    return;
  }
  show('join');
  $('#join-offer').value = c.code;
  doJoin(c.code);
})();

// --- bağlı ekran ---------------------------------------------------------

async function goLive() {
  clearTimeout(connTimer);
  show('live');
  $('#transfers').innerHTML = '';
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {}
}

function onLost() {
  clearTimeout(connTimer);
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
  const wasLive = !$('#v-live').hidden;
  dropPeer();
  show('home');
  showError(
    wasLive
      ? 'Bağlantı koptu.'
      : 'Bağlantı kurulamadı. İki cihaz aynı ağda mı? Değilse “Farklı ağlardayız” seçeneğini aç ve baştan dene.'
  );
}

$('#btn-disconnect').onclick = () => {
  dropPeer();
  wakeLock?.release?.().catch(() => {});
  show('home');
};

const fileInput = $('#file-input');
fileInput.onchange = () => {
  sendFiles([...fileInput.files]);
  fileInput.value = '';
};

const drop = $('#drop');
['dragenter', 'dragover'].forEach((ev) =>
  drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.add('over');
  })
);
['dragleave', 'drop'].forEach((ev) =>
  drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.remove('over');
  })
);
drop.addEventListener('drop', (e) => sendFiles([...e.dataTransfer.files]));

$('#text-send').onclick = () => {
  const box = $('#text-input');
  const v = box.value.trim();
  if (!v) return;
  try {
    peer.sendText(v);
    addNote('Gönderilen', v);
    box.value = '';
  } catch (e) {
    showError(e.message);
  }
};

// --- aktarım listesi -----------------------------------------------------

function addItem(dir, name, size) {
  const li = document.createElement('li');
  const row = document.createElement('div');
  row.className = 'row';
  const n = document.createElement('span');
  n.className = 'name';
  n.textContent = name;
  const m = document.createElement('span');
  m.className = 'meta';
  m.textContent = `${dir} · ${fmtBytes(size)}`;
  row.append(n, m);
  const bar = document.createElement('progress');
  bar.max = 1;
  bar.value = 0;
  li.append(row, bar);
  $('#transfers').prepend(li);
  return { li, bar, meta: m, last: 0 };
}

function setProgress(item, p, force) {
  const now = performance.now();
  if (!force && now - item.last < 100) return; // arayüzü yormamak için seyrelt
  item.last = now;
  item.bar.value = p;
}

function addNote(label, text) {
  const li = document.createElement('li');
  const row = document.createElement('div');
  row.className = 'row';
  const n = document.createElement('span');
  n.className = 'meta';
  n.textContent = label;
  row.append(n);
  const t = document.createElement('div');
  t.className = 'text';
  t.textContent = text;
  const b = document.createElement('button');
  b.textContent = 'Kopyala';
  b.onclick = () => copy(text, b);
  li.append(row, t, b);
  $('#transfers').prepend(li);
}

async function sendFiles(files) {
  for (const file of files) {
    const item = addItem('Gönderiliyor', file.name, file.size);
    try {
      await peer.sendFile(file, (p) => setProgress(item, p));
      setProgress(item, 1, true);
      item.meta.textContent = `Gönderildi · ${fmtBytes(file.size)}`;
    } catch (e) {
      item.meta.textContent = 'Gönderilemedi';
      showError(e.message || String(e));
      break;
    }
  }
}

function onIncoming(f) {
  f.ui = addItem('Alınıyor', f.name, f.size);
}

function onProgress(f) {
  if (f.ui) setProgress(f.ui, f.size ? f.got / f.size : 1);
}

function onFile(f, blob) {
  const item = f.ui;
  if (!item) return;
  setProgress(item, 1, true);
  item.meta.textContent = `Alındı · ${fmtBytes(f.size)}`;
  const a = document.createElement('a');
  a.className = 'dl';
  a.href = URL.createObjectURL(blob);
  a.download = safeName(f.name);
  a.textContent = 'Kaydet';
  item.li.append(a);
}

function onTransferError(f, err) {
  if (f.ui) f.ui.meta.textContent = 'Eksik geldi';
  showError(err.message);
}

function onText(v) {
  addNote('Alınan metin', v);
}

// --- ana ekrana ekleme ---------------------------------------------------

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  $('#btn-install').hidden = false;
});
window.addEventListener('appinstalled', () => {
  deferredInstall = null;
  $('#btn-install').hidden = true;
});
$('#btn-install').onclick = async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  try {
    await deferredInstall.userChoice;
  } catch {}
  deferredInstall = null;
  $('#btn-install').hidden = true;
};

// iOS'ta yükleme istemi yoktur; yolu göster.
const isIOS =
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (isIOS && !isStandalone) $('#ios-hint').hidden = false;

// --- hizmet çalışanı -----------------------------------------------------

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
