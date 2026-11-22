import { Peer, cleanInbox } from './peer.js';
import { qrSvg } from './qr.js';
import { startScan, scanAvailable } from './scan.js';
import { parseCode } from './signal.js';
import { Discovery } from './discover.js';
import { makeZip } from './zip.js';
import { openEditor } from './editor.js';
import { t, setLang, applyI18n } from './i18n.js';

const $ = (s) => document.querySelector(s);
const VIEWS = ['home', 'ask', 'wait', 'host', 'join', 'live'];
const BASE_TITLE = document.title;

let peer = null;
let stopScan = null;
let wakeLock = null;
let disc = null; // yakındaki cihazları bulan bağlantı (yalnızca ana ekranda açık)
let roomCode = null; // 6 haneli oda kodu (yoksa aynı ağdakiler görünür)
let outgoing = null; // cevap beklediğimiz cihaz {id, name}
let incomingReq = null; // onay bekleyen istek {from, name, code, pid}
let peerName = null; // bağlandığımız cihazın adı (biliniyorsa)
let peerPid = null; // karşı cihazın kalıcı kimliği (güvenilen cihaz için)
let waitTimer = null;
let pendingShare = null; // paylaşım menüsünden gelen, gönderilmeyi bekleyen öğeler {files, text}
let pendingFiles = []; // bağlantı koparsa yeniden eşleşme için bellekte korunan dosyalar
const pendingFileSet = new Set();

// --- ayarlar (yalnızca bu cihazda, localStorage) ------------------------

function load(key, def) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : JSON.parse(v);
  } catch {
    return def;
  }
}
function save(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

const settings = Object.assign(
  { lang: 'auto', name: '', stun: false, sound: true, notif: false, auto: false, zip: false },
  load('hg.settings', {})
);
const trusted = load('hg.trusted', {}); // { pid: ad }
const persist = () => save('hg.settings', settings);

// Bu cihaza özgü, kalıcı kimlik: "güvenilen cihaz" eşleşmesi için.
const myPid = (() => {
  let p = load('hg.pid', null);
  if (!p) {
    const a = new Uint8Array(12);
    crypto.getRandomValues(a);
    p = [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
    save('hg.pid', p);
  }
  return p;
})();

setLang(settings.lang);

// --- küçük yardımcılar ---------------------------------------------------

function show(name) {
  stopCamera();
  VIEWS.forEach((v) => ($('#v-' + v).hidden = v !== name));
  if (['home', 'ask', 'wait'].includes(name)) startDisc();
  else stopDisc();
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

function fmtEta(sec) {
  if (!isFinite(sec) || sec < 0) return '';
  if (sec < 60) return t('tr.sec', { n: Math.max(1, Math.round(sec)) });
  if (sec < 3600) return t('tr.min', { n: Math.round(sec / 60) });
  return t('tr.hour', { n: (sec / 3600).toFixed(1) });
}

function safeName(name) {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_') || t('tr.fileDefault');
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
  btn.textContent = t('tr.copied');
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
  return new Peer({
    stun: settings.stun || !!roomCode,
    onOpen: goLive,
    onClose: onLost,
    onIncoming: onIncoming,
    onProgress: onProgress,
    onFile: onFile,
    onError: onTransferError,
    onCancelled: onCancelledByPeer,
    onText: onText,
  });
}

function dropPeer() {
  peer?.close();
  peer = null;
  outgoing = null;
  peerName = null;
  peerPid = null;
  clearTimeout(waitTimer);
}

// --- ayarlar ekranı ------------------------------------------------------

function bindCheck(id, key, after) {
  const el = $(id);
  el.checked = !!settings[key];
  el.onchange = () => {
    settings[key] = el.checked;
    persist();
    after?.(el);
  };
}

bindCheck('#opt-stun', 'stun');
bindCheck('#opt-sound', 'sound');
bindCheck('#opt-zip', 'zip');
bindCheck('#opt-auto', 'auto');
bindCheck('#opt-notif', 'notif', async (el) => {
  if (!el.checked) return;
  let perm = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    el.checked = false;
    settings.notif = false;
    persist();
    showError(t('set.notifDenied'));
  }
});

$('#set-lang').value = settings.lang;
$('#set-lang').onchange = (e) => {
  settings.lang = e.target.value;
  persist();
  setLang(settings.lang);
  refreshDynamicText();
};

$('#set-name').value = settings.name;
$('#set-name').onchange = (e) => {
  settings.name = e.target.value.trim().slice(0, 30);
  e.target.value = settings.name;
  persist();
  if (!$('#v-home').hidden) restartDisc();
};

function renderTrusted() {
  const ul = $('#trusted-list');
  ul.innerHTML = '';
  const ids = Object.keys(trusted);
  if (!ids.length) {
    const li = document.createElement('li');
    li.className = 'hint';
    li.textContent = t('set.trustedNone');
    ul.append(li);
    return;
  }
  for (const pid of ids) {
    const li = document.createElement('li');
    const n = document.createElement('span');
    n.textContent = trusted[pid];
    const b = document.createElement('button');
    b.className = 'link';
    b.textContent = t('set.forget');
    b.onclick = () => {
      delete trusted[pid];
      save('hg.trusted', trusted);
      renderTrusted();
      updateTrustBtn();
    };
    li.append(n, b);
    ul.append(li);
  }
}

function refreshDynamicText() {
  updateNearby();
  renderTrusted();
  renderHistory();
  updateShareBanner();
  if (disc) $('#me-name').textContent = t('nearby.me', { name: disc.name });
  if (!$('#v-live').hidden) {
    $('#live-status').textContent = peerName ? t('live.connectedTo', { name: peerName }) : t('live.connected');
    updateTrustBtn();
  }
  if (roomCode) renderRoom();
}

// --- ana ekran -----------------------------------------------------------

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

// --- yakındaki cihazlar --------------------------------------------------

function startDisc() {
  if (disc) return;
  disc = new Discovery(
    {
      onStatus: setNearbyStatus,
      onPeers: renderPeers,
      onSignal: onSignal,
      onGone: onGone,
    },
    roomCode,
    settings.name || null
  );
  $('#me-name').textContent = t('nearby.me', { name: disc.name });
}

function stopDisc() {
  disc?.stop();
  disc = null;
}

function restartDisc() {
  stopDisc();
  renderPeers([]);
  startDisc();
}

let discState = 'connecting';
let peerCount = 0;

function setNearbyStatus(st) {
  discState = st;
  updateNearby();
}

function updateNearby() {
  const el = $('#nearby-status');
  if (discState === 'connecting') el.textContent = t('nearby.connecting');
  else if (discState === 'offline') el.textContent = t('nearby.offline');
  else if (peerCount) el.textContent = roomCode ? t('nearby.tapRoom', { code: roomCode }) : t('nearby.tap');
  else if (roomCode) el.textContent = t('nearby.inRoom', { code: roomCode });
  else el.textContent = t('nearby.empty');
}

function renderPeers(list) {
  peerCount = list.length;
  const ul = $('#peer-list');
  ul.innerHTML = '';
  for (const p of list) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    const n = document.createElement('span');
    n.className = 'pname';
    n.textContent = p.name;
    const g = document.createElement('span');
    g.className = 'go';
    g.textContent = t('nearby.go');
    b.append(n, g);
    b.onclick = () => requestPeer(p);
    li.append(b);
    ul.append(li);
  }
  updateNearby();
  // İstek gönderen cihaz listeden düştüyse onay ekranını kapat.
  if (incomingReq && !list.some((p) => p.id === incomingReq.from)) {
    incomingReq = null;
    show('home');
  }
}

// Biz bağlanmak istiyoruz: teklifi hazırla, karşıya ilet, onay bekle.
async function requestPeer(p) {
  dropPeer();
  incomingReq = null;
  outgoing = { id: p.id, name: p.name };
  peerName = p.name;
  show('wait');
  $('#wait-text').textContent = t('wait.preparing', { name: p.name });
  peer = makePeer();
  const mine = peer;
  try {
    const code = await mine.createOffer();
    if (peer !== mine) return; // bu arada vazgeçildi
    if (!disc?.send(p.id, { k: 'offer', code, pid: myPid })) throw new Error(t('err.server'));
    $('#wait-text').textContent = t('wait.accept', { name: p.name });
    clearTimeout(waitTimer);
    waitTimer = setTimeout(() => {
      if (peer === mine && outgoing) {
        const name = outgoing.name;
        cancelWait(true);
        showError(t('err.noAnswer', { name }));
      }
    }, 60000);
  } catch (e) {
    if (peer !== mine) return;
    cancelWait(false);
    showError(e.message || String(e));
  }
}

function cancelWait(notify) {
  if (notify && outgoing) disc?.send(outgoing.id, { k: 'cancel' });
  dropPeer();
  show('home');
}

$('#wait-cancel').onclick = () => cancelWait(true);

// Karşı taraftan gelen eşleşme iletileri.
async function onSignal(from, name, data) {
  const k = data && data.k;
  if (k === 'offer') {
    const c = parseCode(data.code);
    if (!c || c.kind !== 'o') return;
    const busy = peer || incomingReq || $('#v-home').hidden;
    if (busy) {
      disc?.send(from, { k: 'decline', why: 'busy' });
      return;
    }
    const pid = typeof data.pid === 'string' ? data.pid.slice(0, 32) : null;
    incomingReq = { from, name: String(name || t('dev.someone')), code: c.code, pid };
    if (settings.auto && pid && trusted[pid]) {
      notifyUser(t('notif.autoAccepted', { name: incomingReq.name }), '');
      acceptIncoming();
      return;
    }
    $('#ask-text').textContent = t('ask.text', { name: incomingReq.name });
    show('ask');
    navigator.vibrate?.(150);
    if (document.hidden) notifyUser(t('ask.title'), incomingReq.name);
  } else if (k === 'answer') {
    if (!outgoing || outgoing.id !== from || !peer) return;
    const c = parseCode(data.code);
    if (!c || c.kind !== 'a') return;
    peerPid = typeof data.pid === 'string' ? data.pid.slice(0, 32) : null;
    clearTimeout(waitTimer);
    $('#wait-text').textContent = t('wait.connecting');
    try {
      await peer.acceptAnswer(c.code);
      armTimeout();
    } catch (e) {
      cancelWait(false);
      showError(e.message || String(e));
    }
  } else if (k === 'decline') {
    if (!outgoing || outgoing.id !== from) return;
    const n = outgoing.name;
    cancelWait(false);
    showError(data.why === 'busy' ? t('err.busy', { name: n }) : t('err.declined', { name: n }));
  } else if (k === 'cancel') {
    if (incomingReq && incomingReq.from === from) {
      incomingReq = null;
      show('home');
    }
  }
}

// Gönderdiğimiz ileti hedefe ulaşmadı: karşı cihaz ayrılmış.
function onGone(id) {
  if (outgoing && outgoing.id === id) {
    const n = outgoing.name;
    cancelWait(false);
    showError(t('err.gone', { name: n }));
  }
}

$('#ask-no').onclick = () => {
  if (incomingReq) disc?.send(incomingReq.from, { k: 'decline' });
  incomingReq = null;
  show('home');
};

$('#ask-yes').onclick = () => acceptIncoming();

async function acceptIncoming() {
  const r = incomingReq;
  if (!r) return;
  incomingReq = null;
  dropPeer();
  peerName = r.name;
  peerPid = r.pid;
  show('wait');
  $('#wait-text').textContent = t('wait.connecting');
  peer = makePeer();
  const mine = peer;
  try {
    const answer = await mine.acceptOffer(r.code);
    if (peer !== mine) return;
    if (!disc?.send(r.from, { k: 'answer', code: answer, pid: myPid })) throw new Error(t('err.server'));
    armTimeout();
  } catch (e) {
    if (peer !== mine) return;
    dropPeer();
    show('home');
    showError(e.message || String(e));
  }
}

// Kodla bağlan: aynı 6 haneli kodu giren cihazlar aynı odaya düşer.
function renderRoom() {
  $('#code-room').hidden = false;
  $('#code-room').innerHTML = '';
  const label = document.createElement('span');
  label.textContent = t('code.yours');
  const big = document.createElement('span');
  big.className = 'bigcode';
  big.textContent = roomCode;
  $('#code-room').append(label, big);
  $('#code-leave').hidden = false;
}

function joinRoom(code) {
  roomCode = code;
  $('#code-input').value = code;
  renderRoom();
  restartDisc();
}

$('#code-new').onclick = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  joinRoom(String(100000 + (a[0] % 900000)));
};

$('#code-go').onclick = () => {
  const v = $('#code-input').value.replace(/\D/g, '');
  if (v.length !== 6) return showError(t('code.six'));
  clearError();
  joinRoom(v);
};

$('#code-leave').onclick = () => {
  roomCode = null;
  $('#code-room').hidden = true;
  $('#code-leave').hidden = true;
  $('#code-input').value = '';
  restartDisc();
};

// --- başlatan cihaz ------------------------------------------------------

async function startHost() {
  dropPeer();
  show('host');
  $('#host-qr').innerHTML = '';
  $('#host-code').value = '';
  $('#host-answer').value = '';
  $('#host-status').textContent = t('host.preparing');
  peer = makePeer();
  try {
    const code = await peer.createOffer();
    $('#host-code').value = code;
    $('#host-qr').innerHTML = qrSvg(qrPayload(code));
    $('#host-status').textContent = t('host.ready');
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
  if (!c) return showError(t('err.answerInvalid'));
  if (c.kind !== 'a') return showError(t('err.notAnswer'));
  try {
    $('#host-status').textContent = t('wait.connecting');
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
      if (!$('#v-wait').hidden) {
        dropPeer();
        show('home');
      }
      showError(t('err.timeout'));
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
  if (!c) return showError(t('err.offerInvalid'));
  if (c.kind !== 'o') return showError(t('err.notOffer'));
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
  $('#join-status').textContent = t('join.preparing');
  peer = makePeer();
  try {
    const answer = await peer.acceptOffer(offerCode);
    $('#join-code').value = answer;
    $('#join-qr').innerHTML = qrSvg(qrPayload(answer));
    $('#join-status').textContent = t('join.ready');
    armTimeout();
  } catch (e) {
    $('#join-step1').hidden = false;
    $('#join-step2').hidden = true;
    showError(e.message || String(e));
  }
}

function cameraError(e) {
  if (e && e.message === 'unsupported') {
    showError(t('err.camUnsupported'));
  } else if (e && e.name === 'NotAllowedError') {
    showError(t('err.camDenied'));
  } else {
    showError(t('err.cam'));
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
    showError(t('err.answerHash'));
    return;
  }
  show('join');
  $('#join-offer').value = c.code;
  doJoin(c.code);
})();

if (!$('#v-home').hidden) startDisc();


// --- bildirim, ses, titreşim --------------------------------------------

let unread = 0;
let audioCtx = null;

function beep() {
  try {
    audioCtx ??= new AudioContext();
    audioCtx.resume?.();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = 880;
    g.gain.value = 0.07;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.12);
  } catch {}
}

function notifyUser(title, body) {
  if (settings.sound) {
    navigator.vibrate?.(120);
    beep();
  }
  if (document.hidden) {
    unread++;
    document.title = `(${unread}) ${BASE_TITLE}`;
    if (settings.notif && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: 'icons/icon-192.png', tag: 'hadiget' });
      } catch {}
    }
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    unread = 0;
    document.title = BASE_TITLE;
    // iOS/Android ekran seçicisi veya başka uygulamadan dönüşte Wake Lock'u yenile.
    keepAwake();
  }
});

// --- bu oturumun geçmişi (yalnızca bellekte) -----------------------------

const history_ = [];

function record(dir, name, size) {
  history_.unshift({ dir, name, size, ts: new Date(), who: peerName || '' });
  if (history_.length > 100) history_.pop();
  renderHistory();
}

function renderHistory() {
  const ul = $('#hist-list');
  ul.innerHTML = '';
  $('#hist-clear').hidden = !history_.length;
  if (!history_.length) {
    const li = document.createElement('li');
    li.className = 'hint';
    li.textContent = t('hist.empty');
    ul.append(li);
    return;
  }
  for (const h of history_) {
    const li = document.createElement('li');
    const hh = h.ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    li.textContent = `${hh} · ${t(h.dir === 'sent' ? 'hist.sent' : 'hist.recv')} · ${h.name} (${fmtBytes(h.size)})${h.who ? ' · ' + h.who : ''}`;
    ul.append(li);
  }
}

$('#hist-clear').onclick = () => {
  history_.length = 0;
  renderHistory();
};

// --- paylaşım menüsünden gelenler (Web Share Target) ---------------------

function updateShareBanner() {
  const n = pendingShare ? pendingShare.files.length + (pendingShare.text ? 1 : 0) : 0;
  $('#share-banner').hidden = !n;
  if (n) $('#share-text').textContent = t('share.banner', { n });
}

$('#share-drop').onclick = () => {
  pendingShare = null;
  updateShareBanner();
};

async function loadShare() {
  if (!('caches' in window)) return;
  try {
    const c = await caches.open('hadiget-share');
    const reqs = await c.keys();
    const files = [];
    let text = '';
    for (const r of reqs) {
      const res = await c.match(r);
      if (new URL(r.url).pathname.endsWith('/text')) {
        text = await res.text();
      } else {
        const blob = await res.blob();
        const name = decodeURIComponent(res.headers.get('X-Name') || '') || t('tr.fileDefault');
        files.push(new File([blob], name, { type: res.headers.get('X-Type') || blob.type }));
      }
    }
    await Promise.all(reqs.map((r) => c.delete(r)));
    if (files.length || text) {
      pendingShare = { files, text };
      updateShareBanner();
    }
  } catch {}
}

// --- bağlı ekran ---------------------------------------------------------

async function keepAwake() {
  if ($('#v-live').hidden || document.visibilityState !== 'visible' || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
    if (wakeLock) wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch {}
}

async function goLive() {
  clearTimeout(connTimer);
  clearTimeout(waitTimer);
  outgoing = null;
  incomingReq = null;
  show('live');
  $('#live-status').textContent = peerName ? t('live.connectedTo', { name: peerName }) : t('live.connected');
  clearItems();
  updateTrustBtn();
  await keepAwake();
  if (pendingShare && peer) {
    const p = pendingShare;
    pendingShare = null;
    updateShareBanner();
    if (p.text) sendTextNow(p.text);
    sendSelection(p.files);
  }
  if (pendingFiles.length && peer) {
    const retry = pendingFiles.splice(0);
    retry.forEach((f) => pendingFileSet.delete(f));
    sendSelection(retry, { folder: retry.some((f) => !!f.webkitRelativePath) });
  }
}

function leaveLive() {
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
  clearItems();
}

function onLost() {
  clearTimeout(connTimer);
  const wasLive = !$('#v-live').hidden;
  leaveLive();
  dropPeer();
  show('home');
  showError(wasLive ? t('err.lost') : t('err.notEstablished'));
}

$('#btn-disconnect').onclick = () => {
  dropPeer();
  leaveLive();
  show('home');
};

function updateTrustBtn() {
  const b = $('#btn-trust');
  b.hidden = !peerPid;
  if (!peerPid) return;
  b.textContent = trusted[peerPid] ? t('live.trusted') : t('live.trust');
}

$('#btn-trust').onclick = () => {
  if (!peerPid) return;
  if (trusted[peerPid]) delete trusted[peerPid];
  else trusted[peerPid] = peerName || t('dev.someone');
  save('hg.trusted', trusted);
  renderTrusted();
  updateTrustBtn();
};

// Dosya seçici, klasör, kamera
const fileInput = $('#file-input');
fileInput.onchange = () => {
  sendSelection([...fileInput.files]);
  fileInput.value = '';
};

if ('webkitdirectory' in HTMLInputElement.prototype) $('#dir-btn').hidden = false;
if (matchMedia('(pointer: coarse)').matches) $('#cam-btn').hidden = false;

$('#dir-input').onchange = (e) => {
  sendSelection([...e.target.files], { folder: true });
  e.target.value = '';
};
$('#cam-input').onchange = (e) => {
  sendSelection([...e.target.files]);
  e.target.value = '';
};

// Klavyeyle de seçilebilsin
$('#drop').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

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

async function walk(entry, prefix, out) {
  if (entry.isFile) {
    const f = await new Promise((res, rej) => entry.file(res, rej));
    f._rel = prefix + entry.name;
    out.push(f);
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    for (;;) {
      const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      for (const en of batch) await walk(en, prefix + entry.name + '/', out);
    }
  }
}

drop.addEventListener('drop', async (e) => {
  // dataTransfer yalnızca olay sırasında geçerli: girdileri hemen al
  const entries = [...(e.dataTransfer.items || [])].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
  const plain = [...e.dataTransfer.files];
  if (entries.some((en) => en.isDirectory)) {
    const files = [];
    try {
      for (const en of entries) await walk(en, '', files);
    } catch {}
    sendSelection(files, { folder: true });
  } else {
    sendSelection(plain);
  }
});

// Panodan yapıştır (görsel/dosya)
document.addEventListener('paste', (e) => {
  if ($('#v-live').hidden || !peer) return;
  const files = [...(e.clipboardData?.files || [])];
  if (!files.length) return;
  e.preventDefault();
  const stamp = new Date().toTimeString().slice(0, 8).replaceAll(':', '');
  sendSelection(
    files.map((f, i) => {
      if (f.name && !/^image\.\w+$/i.test(f.name)) return f;
      const ext = (f.type.split('/')[1] || 'bin').replace('jpeg', 'jpg').replace(/\+.*/, '');
      return new File([f], `${t('tr.pasted')}-${stamp}${files.length > 1 ? '-' + (i + 1) : ''}.${ext}`, { type: f.type });
    })
  );
});

function sendTextNow(v) {
  peer.sendText(v);
  addNote(t('tr.noteSent'), v);
}

$('#text-send').onclick = () => {
  const box = $('#text-input');
  const v = box.value.trim();
  if (!v) return;
  try {
    sendTextNow(v);
    box.value = '';
  } catch (e) {
    showError(e.message);
  }
};

// --- aktarım listesi -----------------------------------------------------

const items = new Set();

function clearItems() {
  for (const it of items) {
    it.urls.forEach((u) => URL.revokeObjectURL(u));
    try { it.cleanup?.(); } catch {}
  }
  items.clear();
  $('#transfers').innerHTML = '';
}

function url(item, blob) {
  const u = URL.createObjectURL(blob);
  item.urls.push(u);
  return u;
}

function addItem(label, name, size) {
  const li = document.createElement('li');
  const row = document.createElement('div');
  row.className = 'row';
  const n = document.createElement('span');
  n.className = 'name';
  n.textContent = name;
  const m = document.createElement('span');
  m.className = 'meta';
  m.textContent = `${label} · ${fmtBytes(size)}`;
  row.append(n, m);
  const bar = document.createElement('progress');
  bar.max = 1;
  bar.value = 0;
  bar.setAttribute('aria-label', name);
  const stats = document.createElement('div');
  stats.className = 'meta stats';
  const preview = document.createElement('div');
  preview.className = 'preview';
  const actions = document.createElement('div');
  actions.className = 'actions';
  li.append(row, bar, stats, preview, actions);
  $('#transfers').prepend(li);
  const item = { li, bar, meta: m, stats, preview, actions, size, name, urls: [], last: 0, t0: 0, lt: 0, lb: 0, speed: 0, cancelBtn: null, cleanup: null };
  items.add(item);
  return item;
}

function setProgress(item, p, force) {
  const now = performance.now();
  if (!item.t0) {
    item.t0 = item.lt = now;
  }
  if (!force && now - item.last < 100) return; // arayüzü yormamak için seyrelt
  item.last = now;
  item.bar.value = p;
  const bytes = p * item.size;
  const dt = (now - item.lt) / 1000;
  if (dt > 0.2) {
    const inst = (bytes - item.lb) / dt;
    item.speed = item.speed ? item.speed * 0.7 + inst * 0.3 : inst;
    item.lt = now;
    item.lb = bytes;
  }
  if (p < 1 && item.speed > 0) {
    item.stats.textContent = `${fmtBytes(item.speed)}/${t('tr.sec', { n: '' }).trim()} · ${t('tr.eta', { t: fmtEta((item.size - bytes) / item.speed) })}`;
  } else {
    item.stats.textContent = '';
  }
}

function addCancel(item, fn) {
  const b = document.createElement('button');
  b.className = 'danger';
  b.textContent = t('tr.cancel');
  b.onclick = () => {
    b.disabled = true;
    fn();
  };
  item.cancelBtn = b;
  item.actions.append(b);
}

function endItem(item, label) {
  item.cancelBtn?.remove();
  item.cancelBtn = null;
  item.stats.textContent = '';
  item.meta.textContent = `${label} · ${fmtBytes(item.size)}`;
}

const IMG_OK = /^image\/(png|jpe?g|gif|webp|bmp|avif)$/i;

async function addPreview(item, blob, name) {
  const type = blob.type || '';
  if (IMG_OK.test(type) && blob.size < 50 * 1024 * 1024) {
    const img = document.createElement('img');
    img.alt = name;
    img.loading = 'lazy';
    img.src = url(item, blob);
    item.preview.append(img);
  } else if (/^video\//.test(type)) {
    const v = document.createElement('video');
    v.controls = true;
    v.preload = 'metadata';
    v.playsInline = true;
    v.src = url(item, blob);
    item.preview.append(v);
  } else if (/^audio\//.test(type)) {
    const a = document.createElement('audio');
    a.controls = true;
    a.preload = 'metadata';
    a.src = url(item, blob);
    item.preview.append(a);
  } else if ((/^text\//.test(type) || /\.(txt|md|csv|json|log)$/i.test(name)) && blob.size <= 2 * 1024 * 1024) {
    try {
      const txt = await blob.slice(0, 1500).text();
      const pre = document.createElement('pre');
      pre.textContent = txt + (blob.size > 1500 ? '\n…' : '');
      item.preview.append(pre);
    } catch {}
  }
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = safeName(name);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

function addEdit(item, blob, name) {
  if (!IMG_OK.test(blob.type || '') || blob.size > 50 * 1024 * 1024) return;
  const b = document.createElement('button');
  b.className = 'edit';
  b.textContent = t('tr.edit');
  b.onclick = () =>
    openEditor(blob, {
      name,
      canSend: () => !!peer && !$('#v-live').hidden && peer.dc?.readyState === 'open',
      onSave: (out, outName) => download(out, outName),
      onSend: (out, outName) => sendFiles([new File([out], outName, { type: out.type })]),
    });
  item.actions.append(b);
}

function addNote(label, text) {
  const li = document.createElement('li');
  const row = document.createElement('div');
  row.className = 'row';
  const n = document.createElement('span');
  n.className = 'meta';
  n.textContent = label;
  row.append(n);
  const tx = document.createElement('div');
  tx.className = 'text';
  tx.textContent = text;
  const b = document.createElement('button');
  b.textContent = t('tr.copy');
  b.onclick = () => copy(text, b);
  li.append(row, tx, b);
  $('#transfers').prepend(li);
}

// Bağlantı yokken de kullanıcının seçtiği File nesnelerini sekme belleğinde tut.
// Yeni bağlantı kurulduğunda aynı dosyalar yeniden sıraya alınır.
function queuePendingFiles(files) {
  for (const file of files) {
    if (!file || pendingFileSet.has(file)) continue;
    pendingFileSet.add(file);
    pendingFiles.push(file);
  }
  if (pendingFiles.length) showError(t('tr.pendingReconnect', { n: pendingFiles.length }));
}

// Dosya(lar)ı gönder; klasör ya da "tek zip" seçiliyse önce zip hazırla.
async function sendSelection(files, opts = {}) {
  files = files.filter(Boolean);
  if (!files.length) return;
  if (!peer || peer.closed || peer.dc?.readyState !== 'open') {
    queuePendingFiles(files);
    return;
  }
  const rel = (f) => f._rel || f.webkitRelativePath || f.name;
  const zip = opts.folder || (settings.zip && files.length > 1);
  if (!zip) return sendFiles(files);
  const first = rel(files[0]);
  const zname = opts.folder && first.includes('/') ? first.split('/')[0] + '.zip' : `hadiGET-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1-')}.zip`;
  const total = files.reduce((a, f) => a + f.size, 0);
  const item = addItem(t('tr.zipping'), zname, total);
  try {
    const blob = await makeZip(files.map((f) => ({ name: rel(f), file: f })), (p) => setProgress(item, p));
    item.li.remove();
    items.delete(item);
    sendFiles([new File([blob], zname, { type: 'application/zip' })]);
  } catch (e) {
    item.li.remove();
    items.delete(item);
    showError(t('tr.zipFail', { msg: e.message === 'too-big' ? t('tr.zipBig') : e.message }));
  }
}

function sendFiles(files) {
  const p = peer;
  if (!p) return;
  for (const file of files) {
    const item = addItem(t('tr.queued'), file.name, file.size);
    let tr;
    try {
      tr = p.sendFile(file, (pr) => setProgress(item, pr));
    } catch (e) {
      endItem(item, t('tr.failed'));
      showError(e.message);
      continue;
    }
    tr.onStart = () => (item.meta.textContent = `${t('tr.sending')} · ${fmtBytes(file.size)}`);
    addCancel(item, () => tr.cancel());
    tr.done.then(
      () => {
        setProgress(item, 1, true);
        endItem(item, t('tr.sent'));
        record('sent', file.name, file.size);
        addPreview(item, file, file.name);
        addEdit(item, file, file.name);
      },
      (e) => {
        if (e && e.cancelled) endItem(item, e.byPeer ? t('tr.cancelledByPeer') : t('tr.cancelled'));
        else if (!peer || peer !== p || p.closed || p.dc?.readyState !== 'open') {
          endItem(item, t('tr.queued'));
          queuePendingFiles([file]);
        } else {
          endItem(item, t('tr.failed'));
          showError(e.message || String(e));
        }
      }
    );
  }
}

function onIncoming(f) {
  f.ui = addItem(t('tr.receiving'), f.name, f.size);
  addCancel(f.ui, () => {
    peer?.cancelIncoming(f);
    endItem(f.ui, t('tr.cancelled'));
  });
}

function onProgress(f) {
  if (f.ui) setProgress(f.ui, f.size ? f.got / f.size : 1);
}

function onFile(f, blob) {
  const item = f.ui;
  if (!item) return;
  setProgress(item, 1, true);
  endItem(item, t('tr.received'));
  item.cleanup = f.cleanup || null;
  const a = document.createElement('a');
  a.className = 'dl';
  a.href = url(item, blob);
  a.download = safeName(f.name);
  a.textContent = t('tr.save');
  item.actions.append(a);
  addPreview(item, blob, f.name);
  addEdit(item, blob, f.name);
  record('recv', f.name, f.size);
  notifyUser(t('notif.file', { name: peerName || t('notif.someone') }), f.name);
}

function onCancelledByPeer(f) {
  if (f.ui) endItem(f.ui, t('tr.cancelledByPeer'));
}

function onTransferError(f, err) {
  if (f.ui) endItem(f.ui, t('tr.incomplete'));
  showError(err.message);
}

function onText(v) {
  addNote(t('tr.noteRecv'), v);
  notifyUser(t('notif.text', { name: peerName || t('notif.someone') }), v.slice(0, 80));
}

// Ses, kullanıcı etkileşiminden sonra çalabilir: ilk dokunuşta hazırla.
window.addEventListener('pointerdown', () => { try { audioCtx ??= new AudioContext(); audioCtx.resume?.(); } catch {} }, { once: true });

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

// --- açılış --------------------------------------------------------------

applyI18n();
renderTrusted();
renderHistory();
updateNearby();
cleanInbox();
if (location.search.includes('share=1')) {
  history.replaceState(null, '', location.pathname);
  loadShare();
}

// --- hizmet çalışanı -----------------------------------------------------

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
