const $ = (selector) => document.querySelector(selector);
const fileInput = $('#file-input');
const dropzone = $('#dropzone');
const queueList = $('#queue-list');
const targetSelect = $('#target-format');
const allFormats = {
  image: [
    { id: 'png', mime: 'image/png', label: 'PNG', note: 'kayıpsız, şeffaflık destekli' },
    { id: 'jpeg', mime: 'image/jpeg', label: 'JPEG', note: 'kayıplı, şeffaflık yok' },
    { id: 'webp', mime: 'image/webp', label: 'WebP', note: 'tarayıcı kodlayıcısına bağlı' },
    { id: 'avif', mime: 'image/avif', label: 'AVIF', note: 'tarayıcı kodlayıcısına bağlı' },
  ],
  video: [{ id: 'webm', mime: 'video/webm', label: 'WebM', note: 'cihazdaki MediaRecorder kodekleri' }],
};
const supportedVideoTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
const state = {
  items: [], activeKind: 'all', imageFormat: 'png', videoFormat: 'webm', videoCodec: 'auto', qualityMode: 'lossless', running: false,
  imageEncoders: new Set(['image/png']), videoMime: '', installPrompt: null,
};
const imageExtensions = new Set(['png','jpg','jpeg','webp','gif','bmp','svg','tif','tiff','avif','heic','heif','ico','apng','jfif','jxl','dng','cr2','nef','arw','raw']);
const videoExtensions = new Set(['mp4','m4v','mov','mkv','webm','avi','wmv','flv','3gp','ts','mts','m2ts','mpg','mpeg','ogv','mxf','vob','hevc','h264','h265','asf']);

function extOf(name) { return (name.split('.').pop() || '').toLowerCase(); }
function kindOf(file) {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  const ext = extOf(file.name);
  if (videoExtensions.has(ext)) return 'video';
  if (imageExtensions.has(ext)) return 'image';
  return null;
}
function bytes(value) {
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 1024) return `${value} B`;
  const units = ['KB','MB','GB','TB'];
  let n = value / 1024; let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}
function durationText(seconds) {
  if (!Number.isFinite(seconds)) return 'süre bilinmiyor';
  const s = Math.round(seconds); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function fileId() { return globalThis.crypto?.randomUUID?.() || `f${Date.now()}${Math.random().toString(16).slice(2)}`; }
function toast(message, warning = false) {
  const node = document.createElement('div'); node.className = `toast${warning ? ' warning' : ''}`; node.textContent = message;
  $('#toast-region').append(node); window.setTimeout(() => node.remove(), 3900);
}

async function supportsImageEncoder(mime) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 2;
    canvas.toBlob((blob) => resolve(Boolean(blob && blob.type === mime)), mime, .9);
  });
}

function updateEngineStatus() {
  const active = state.videoMime ? `WebM · ${state.videoMime.split(';')[1]?.trim() || 'tarayıcı kodlayıcısı'}` : 'Görsel motoru hazır';
  $('#engine-status-text').textContent = active;
}

function refreshFormatMenu() {
  const relevant = state.activeKind === 'all' ? ['image','video'] : [state.activeKind];
  const parts = [];
  for (const kind of relevant) {
    const formats = kind === 'image' ? allFormats.image.filter((x) => state.imageEncoders.has(x.mime)) : (state.videoMime ? allFormats.video : []);
    if (!formats.length) continue;
    const label = kind === 'image' ? 'GÖRSEL' : 'VİDEO';
    parts.push(`<optgroup label="${label}">${formats.map((format) => `<option value="${kind}:${format.id}">${format.label}${kind === 'image' ? ` — ${format.id === 'png' ? 'kayıpsız' : 'görsel'}` : ' — tarayıcı kodeği'}</option>`).join('')}</optgroup>`);
  }
  targetSelect.innerHTML = parts.join('') || '<option value="">Bu tarayıcıda çıkış biçimi yok</option>';
  let desired = state.activeKind === 'video' ? `video:${state.videoFormat}` : `image:${state.imageFormat}`;
  if (state.activeKind === 'all' && state.items.some((x) => x.kind === 'video') && !state.items.some((x) => x.kind === 'image')) desired = `video:${state.videoFormat}`;
  if (!targetSelect.querySelector(`option[value="${desired}"]`)) desired = targetSelect.querySelector('option')?.value || '';
  targetSelect.value = desired;
  if (desired) {
    const [kind, format] = desired.split(':');
    if (kind === 'image') state.imageFormat = format; else state.videoFormat = format;
  }
  updateQualityAvailability();
  updateFormatHint();
  updateEstimate();
}

function selectedFormat(kind) { return kind === 'video' ? state.videoFormat : state.imageFormat; }
function chosenItemKind() {
  if (state.activeKind !== 'all') return state.activeKind;
  return state.items.find((item) => item.state === 'ready')?.kind || 'image';
}
function updateQualityAvailability() {
  const kind = chosenItemKind();
  const imageFormat = state.imageFormat;
  const exactLossless = kind === 'image' && imageFormat === 'png';
  $('#lossless-button').disabled = !exactLossless;
  $('#lossless-button').hidden = !exactLossless;
  $('#lossless-button').classList.toggle('disabled', !exactLossless);
  $('#quality-button').classList.toggle('active', state.qualityMode === 'highest' || !exactLossless);
  $('#lossless-button').classList.toggle('active', state.qualityMode === 'lossless' && exactLossless);
  if (!exactLossless && state.qualityMode === 'lossless') state.qualityMode = 'highest';
  const imageMode = kind === 'image';
  $('.quality-cell>label').textContent = exactLossless ? 'KALİTE YAKLAŞIMI' : 'KODLAMA KALİTESİ';
  document.querySelectorAll('.quality-control,.alpha-control').forEach((element) => { element.classList.toggle('disabled', !imageMode); element.classList.toggle('video-control-hidden', !imageMode); });
  document.querySelectorAll('.resolution-control,.fps-control,.bitrate-control,.codec-control').forEach((element) => element.classList.toggle('video-control-hidden', imageMode));
  $('#settings-context').textContent = imageMode ? 'GÖRSELE UYGUN' : 'VİDEOYA UYGUN';
  updateEstimate();
}

function updateFormatHint() {
  const node = $('#format-hint');
  const selected = targetSelect.value;
  if (!selected) { node.querySelector('span:last-child').textContent = 'Tarayıcın bu uygulamada kullanılabilir bir hedef biçim raporlamadı.'; node.className = 'format-hint warning'; return; }
  const [kind, id] = selected.split(':');
  const isPng = kind === 'image' && id === 'png';
  const hasMatchingItems = state.items.some((item) => item.kind === kind);
  node.className = `format-hint${isPng ? ' good' : kind === 'video' ? ' warning' : ''}`;
  if (kind === 'image') {
    node.querySelector('span:last-child').textContent = isPng
      ? 'PNG kodlaması kayıpsızdır; tarayıcı yeniden işlerken EXIF/metaveri ve renk profili korunmayabilir. JPEG kaynağın kayıplarını geri getiremez; animasyonlar tek kareye indirgenebilir.'
      : id === 'jpeg'
        ? 'JPEG kayıplı biçimdir ve şeffaflığı korumaz. Kalite ayarı tarayıcı kodlayıcısına uygulanır.'
        : `${id.toUpperCase()} kodlayıcısı bu cihazda kullanılabilir. Kalite/şeffaflık davranışı tarayıcı uygulamasına bağlıdır; WebP/AVIF için kayıpsız kodlama garantisi verilmez.`;
  } else {
    const probe = document.createElement('video');
    const audio = typeof probe.captureStream === 'function' || typeof probe.mozCaptureStream === 'function';
    node.querySelector('span:last-child').textContent = `Video, tarayıcının MediaRecorder desteğiyle gerçek zamanlı WebM olarak kodlanır; bu işlem kayıpsız değildir. ${audio ? 'Tarayıcı destekliyorsa kaynak ses izi de yakalanır.' : 'Bu tarayıcıda ses yakalama özelliği algılanmadı; ses çıkmayabilir.'} Başka konteynerler/codecler tarayıcıda açılamayabilir.`;
  }
  if (hasMatchingItems && kind === 'video' && !state.videoMime) node.className = 'format-hint warning';
}

function updateCounts() {
  const nImage = state.items.filter((item) => item.kind === 'image').length;
  const nVideo = state.items.filter((item) => item.kind === 'video').length;
  $('#all-count').textContent = String(state.items.length).padStart(2,'0');
  $('#image-count').textContent = String(nImage).padStart(2,'0');
  $('#video-count').textContent = String(nVideo).padStart(2,'0');
  $('#queue-total').textContent = String(state.items.length).padStart(2,'0');
  const hasReady = state.items.some((item) => item.state === 'ready' && (state.activeKind === 'all' || item.kind === state.activeKind));
  $('#convert-button').disabled = !hasReady || state.running;
  $('#clear-button').disabled = !state.items.length || state.running;
  $('#download-all').disabled = !state.items.some((item) => item.outputBlob);
}

function setActiveKind(kind) {
  state.activeKind = kind;
  document.querySelectorAll('.kind-button').forEach((button) => {
    const selected = button.dataset.kind === kind;
    button.classList.toggle('selected', selected); if (selected) button.setAttribute('aria-pressed','true'); else button.removeAttribute('aria-pressed');
  });
  refreshFormatMenu(); renderQueue();
}

function updateEstimate() {
  const candidates = state.items.filter((item) => item.state === 'ready' && (state.activeKind === 'all' || item.kind === state.activeKind));
  const outputKind = targetSelect.value.split(':')[0];
  const sample = candidates.find((item) => item.kind === outputKind) || candidates[0];
  if (!sample) { $('#estimate-value').textContent = '—'; $('#estimate-note').textContent = 'Dosya seçildiğinde hesaplanır'; return; }
  let estimate; let note;
  if (sample.kind === 'video') {
    const duration = sample.metadata.duration;
    const bitrate = Number($('#bitrate').value) || 8_000_000;
    estimate = Number.isFinite(duration) ? duration * (bitrate + 128_000) / 8 : sample.file.size;
    note = `Yaklaşık · ${$('#resolution').value === 'original' ? 'kaynak çözünürlüğü' : `≤${$('#resolution').value}p`} · ses varsa değişebilir`;
  } else {
    const output = state.imageFormat;
    estimate = output === 'png' ? sample.file.size * 1.25 : sample.file.size * (Number($('#quality-range').value) / 100) * .82;
    note = `${output.toUpperCase()} için yaklaşık · kaynak ve görüntü içeriğine göre değişir`;
  }
  $('#estimate-value').textContent = `~${bytes(estimate)}`;
  $('#estimate-note').textContent = note;
}

function fileMetadata(file, kind) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    if (kind === 'image') {
      const image = new Image();
      image.onload = () => { resolve({ width: image.naturalWidth, height: image.naturalHeight, duration: null, url }); };
      image.onerror = () => { resolve({ width: null, height: null, duration: null, url, decodeError: 'Bu tarayıcı dosyanın görüntüsünü açamadı.' }); };
      image.src = url;
      return;
    }
    const video = document.createElement('video');
    video.preload = 'metadata'; video.muted = true; video.onloadedmetadata = () => { resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration, url }); };
    video.onerror = () => { resolve({ width: null, height: null, duration: null, url, decodeError: 'Bu tarayıcı kaynak videoyu açamadı veya formatını çözemedi.' }); };
    video.src = url;
  });
}

async function addFiles(fileList) {
  const files = [...fileList];
  let added = 0;
  for (const file of files) {
    const kind = kindOf(file);
    if (!kind) { toast(`${file.name}: görsel veya video olarak tanınmadı.`, true); continue; }
    const duplicate = state.items.some((item) => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified);
    if (duplicate) continue;
    const metadata = await fileMetadata(file, kind);
    const item = { id: fileId(), file, kind, metadata, state: metadata.decodeError ? 'error' : 'ready', progress: 0, outputBlob: null, outputName: '', error: metadata.decodeError || '' };
    state.items.push(item); added += 1;
  }
  renderQueue(); updateCounts(); updateQualityAvailability();
  if (added) toast(`${added} dosya kuyruğa eklendi${state.items.some((item) => item.metadata.decodeError) ? ' · bazı dosyalar tarayıcıda açılamadı' : ''}.`, state.items.some((item) => item.metadata.decodeError));
  fileInput.value = '';
}

function detailsFor(item) {
  const m = item.metadata;
  const dim = m.width && m.height ? `${m.width} × ${m.height}` : 'boyut bilinmiyor';
  return item.kind === 'video' ? `${dim} · ${durationText(m.duration)}` : dim;
}

function extensionFor(item) {
  return item.kind === 'video' ? 'webm' : state.imageFormat === 'jpeg' ? 'jpg' : state.imageFormat;
}
function targetLabel(item) {
  return item.kind === 'video' ? 'WebM' : state.imageFormat.toUpperCase();
}
function statusLabel(item) {
  if (item.state === 'ready') return '<span class="status-ready">Hazır</span>';
  if (item.state === 'processing') return '<span>İşleniyor</span>';
  if (item.state === 'done') return '<span class="status-done">Tamamlandı</span>';
  return `<span class="status-error" title="${escapeHtml(item.error)}">Açılamadı</span>`;
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function renderQueue() {
  const visible = state.items.filter((item) => state.activeKind === 'all' || item.kind === state.activeKind);
  if (!visible.length) {
    queueList.innerHTML = '<div class="empty-queue"><div class="empty-orbit"><span>＋</span></div><strong>Kuyruk henüz boş</strong><p>Bir ya da daha fazla medya dosyası ekleyerek başla.</p></div>';
    return;
  }
  queueList.innerHTML = visible.map((item) => {
    const icon = item.kind === 'video' ? 'VID' : 'IMG';
    const source = extOf(item.file.name).toUpperCase() || item.file.type.split('/')[1]?.toUpperCase() || 'DOSYA';
    const after = item.outputBlob ? `${targetLabel(item)} · ${bytes(item.outputBlob.size)}` : `${targetLabel(item)} · ${item.state === 'done' ? 'hazır' : 'bekliyor'}`;
    const audioNote = item.kind === 'video' && item.state === 'done' && !item.audioCaptured ? ' · ses izi yok/yakalanmadı' : '';
    const progress = item.state === 'done' ? 100 : item.progress;
    return `<article class="queue-item" data-id="${item.id}">
      <div class="queue-file"><span class="file-type-icon ${item.kind}">${icon}</span><span class="file-name"><strong title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</strong><small>${detailsFor(item)} · ${bytes(item.file.size)}</small></span></div>
      <div class="from-to">${source}<b>→</b>${targetLabel(item)}</div>
      <div class="file-status">${statusLabel(item)}<small>${escapeHtml(item.outputBlob ? after : detailsFor(item))}${escapeHtml(audioNote)}</small></div>
      <div class="progress-cell"><span class="progress-track"><i style="width:${progress}%"></i></span><span class="progress-num">${progress}%</span></div>
      <button class="remove-item" type="button" data-remove="${item.id}" aria-label="${escapeHtml(item.file.name)} kuyruktan kaldır" ${state.running ? 'disabled' : ''}>×</button>
      ${item.error ? `<span style="grid-column:1/-1;color:#ff9a80;font-size:8px">${escapeHtml(item.error)}</span>` : ''}
      ${item.outputBlob ? `<button type="button" class="text-button" data-download="${item.id}" style="grid-column:1/-1;text-align:left;font-size:9px">↓ Çıktıyı indir (${bytes(item.outputBlob.size)})</button>` : ''}
    </article>`;
  }).join('');
}

function setProgress(item, progress) {
  item.progress = Math.min(100, Math.max(0, Math.round(progress)));
  const row = queueList.querySelector(`[data-id="${CSS.escape(item.id)}"]`);
  if (row) { const bar = row.querySelector('.progress-track i'); const num = row.querySelector('.progress-num'); if (bar) bar.style.width = `${item.progress}%`; if (num) num.textContent = `${item.progress}%`; }
}

function loadImage(file, url) {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Görsel bu tarayıcıda çözümlenemedi.')); image.src = url;
  });
}
function canvasBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (!blob) return reject(new Error('Tarayıcı seçilen çıkış biçimini kodlayamadı.'));
    if (blob.type !== mime) return reject(new Error(`${mime} kodlayıcısı kullanılamıyor; tarayıcı ${blob.type || 'bilinmeyen'} üretti.`));
    resolve(blob);
  }, mime, quality));
}

async function convertImage(item) {
  const image = await loadImage(item.file, item.metadata.url);
  setProgress(item, 25);
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { alpha: true });
  const format = state.imageFormat; const mime = allFormats.image.find((x) => x.id === format).mime;
  if (format === 'jpeg' || !$('#transparent-bg').checked) { context.fillStyle = '#ffffff'; context.fillRect(0,0,canvas.width,canvas.height); }
  context.drawImage(image,0,0); setProgress(item, 68);
  const quality = Number($('#quality-range').value) / 100;
  const blob = await canvasBlob(canvas,mime,format === 'png' ? undefined : quality);
  setProgress(item,95);
  return blob;
}

function outputDimensions(item) {
  const w = item.metadata.width; const h = item.metadata.height;
  if (!w || !h || $('#resolution').value === 'original') return { width:w || 1280, height:h || 720 };
  const cap = Number($('#resolution').value) * 1;
  const long = Math.max(w,h); const scale = Math.min(1,cap/long);
  return { width:Math.max(2,Math.round(w*scale/2)*2),height:Math.max(2,Math.round(h*scale/2)*2) };
}
function chooseVideoMime(codec = state.videoCodec) {
  if (!window.MediaRecorder) return '';
  const candidates = codec === 'auto' ? supportedVideoTypes : supportedVideoTypes.filter((type) => type.toLowerCase().includes(`codecs=${codec}`));
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}
function captureStream(video, canvas, fps) {
  if (canvas.captureStream) return canvas.captureStream(fps);
  return null;
}

async function convertVideo(item) {
  if (!state.videoMime) throw new Error('Bu tarayıcıda WebM MediaRecorder kodlayıcısı bulunamadı.');
  const video = document.createElement('video');
  video.src = item.metadata.url; video.playsInline = true; video.preload = 'auto'; video.muted = true; video.crossOrigin = 'anonymous';
  await new Promise((resolve,reject) => {
    if (video.readyState >= 2) return resolve();
    video.onloadeddata = () => resolve(); video.onerror = () => reject(new Error('Video açılamadı. Bu kodek tarayıcıda çözümlenemiyor.'));
  });
  const dims = outputDimensions(item); const canvas = document.createElement('canvas'); canvas.width = dims.width; canvas.height = dims.height;
  const ctx = canvas.getContext('2d',{alpha:false});
  const fps = Number($('#fps').value) || 30;
  const stream = captureStream(video,canvas,fps);
  if (!stream) throw new Error('Bu tarayıcı canvas video yakalamayı desteklemiyor.');
  let sourceStream = null;
  try { sourceStream = video.captureStream?.() || video.mozCaptureStream?.() || null; } catch {}
  const audioTracks = sourceStream?.getAudioTracks() || [];
  item.audioCaptured = audioTracks.length > 0;
  for (const track of audioTracks) stream.addTrack(track);
  const options = { mimeType:state.videoMime, videoBitsPerSecond:Number($('#bitrate').value) };
  let recorder;
  try { recorder = new MediaRecorder(stream,options); } catch (error) { stream.getTracks().forEach((track)=>track.stop()); throw new Error(`Bu cihaz seçilen WebM kodlayıcısını açamadı: ${error.message}`); }
  const chunks = [];
  const finished = new Promise((resolve,reject) => {
    recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
    recorder.onerror = () => reject(new Error('Video kodlama işlemi başarısız oldu.'));
    recorder.onstop = () => {
      const blob = new Blob(chunks,{type:recorder.mimeType || state.videoMime});
      if (!blob.size) reject(new Error('Kodlama boş bir dosya üretti.')); else resolve(blob);
    };
  });
  const draw = () => {
    if (video.readyState >= 2 && !video.ended) {
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      if (Number.isFinite(video.duration) && video.duration > 0) setProgress(item,Math.min(92,(video.currentTime/video.duration)*92));
      requestAnimationFrame(draw);
    }
  };
  recorder.start(500);
  requestAnimationFrame(draw);
  const stopRecorder = () => { if (recorder.state !== 'inactive') recorder.stop(); };
  video.addEventListener('ended',stopRecorder,{once:true});
  try {
    await video.play();
    const result = await finished;
    return result;
  } catch (error) {
    if (recorder.state !== 'inactive') recorder.stop();
    try { await finished; } catch {}
    throw error instanceof Error ? error : new Error('Video oynatılamadı.');
  } finally {
    stream.getTracks().forEach((track)=>track.stop());
    sourceStream?.getTracks().forEach((track)=>track.stop());
    video.pause(); video.removeAttribute('src'); video.load();
  }
}

async function convertItem(item) {
  item.state = 'processing'; item.progress = 0; item.error = ''; item.outputBlob = null; renderQueue();
  try {
    const blob = item.kind === 'image' ? await convertImage(item) : await convertVideo(item);
    item.outputBlob = blob;
    const baseName = item.file.name.replace(/\.[^.]+$/,'') || 'formatlab-output';
    item.outputName = `${baseName}.${extensionFor(item)}`; item.state = 'done'; item.progress = 100;
  } catch (error) {
    item.state = 'error'; item.error = error.message || 'Dönüştürme başarısız oldu.';
  }
  renderQueue(); updateCounts();
}

async function convertQueue() {
  if (state.running) return;
  const ready = state.items.filter((item) => item.state === 'ready' && (state.activeKind === 'all' || item.kind === state.activeKind));
  if (!ready.length) { toast('Dönüştürülebilecek hazır dosya yok.',true); return; }
  state.running = true; updateCounts(); renderQueue();
  for (const item of ready) await convertItem(item);
  state.running = false; renderQueue(); updateCounts(); updateEstimate();
  const done = ready.filter((item)=>item.outputBlob).length;
  toast(`${done}/${ready.length} dosya dönüştürüldü${done < ready.length ? ' · başarısız öğeler için açıklamayı kontrol et' : ''}.`,done < ready.length);
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.style.display='none'; document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
}
function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) { crc ^= byte; for (let j=0;j<8;j+=1) crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320); }
  return (crc ^ -1) >>> 0;
}
function dosDateTime(date = new Date()) {
  const year = Math.max(1980,date.getFullYear());
  return { date:((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate(),time:(date.getHours()<<11)|(date.getMinutes()<<5)|Math.floor(date.getSeconds()/2) };
}
function makeZip(files) {
  const enc = new TextEncoder(); const local = []; const stamp = dosDateTime();
  for (const file of files) {
    const name = enc.encode(file.name);
    // ZIP creation below is asynchronous so each entry is fully materialized before writing.
    local.push({name,blob:file.blob});
  }
  return (async()=>{
    const localParts=[]; const centralParts=[]; let cursor=0;
    for(const entry of local){
      const data=new Uint8Array(await entry.blob.arrayBuffer()); const crc=crc32(data); const name=entry.name;
      const header=new Uint8Array(30+name.length); const view=new DataView(header.buffer);
      view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x0800,true);view.setUint16(8,0,true);view.setUint16(10,stamp.time,true);view.setUint16(12,stamp.date,true);view.setUint32(14,crc,true);view.setUint32(18,data.length,true);view.setUint32(22,data.length,true);view.setUint16(26,name.length,true);view.setUint16(28,0,true);header.set(name,30);
      localParts.push(header,data);
      const c=new Uint8Array(46+name.length);const cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(10,0,true);cv.setUint16(12,stamp.time,true);cv.setUint16(14,stamp.date,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint16(30,0,true);cv.setUint16(32,0,true);cv.setUint16(34,0,true);cv.setUint16(36,0,true);cv.setUint32(38,0,true);cv.setUint32(42,cursor,true);c.set(name,46);centralParts.push(c);cursor+=header.length+data.length;
    }
    const centralSize=centralParts.reduce((sum,part)=>sum+part.length,0);const end=new Uint8Array(22);const ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,cursor,true);ev.setUint16(20,0,true);
    return new Blob([...localParts,...centralParts,end],{type:'application/zip'});
  })();
}
const MAX_ZIP_BYTES = 128 * 1024 * 1024;
async function downloadCompletedZip() {
  const files = state.items.filter((item)=>item.outputBlob).map((item)=>({blob:item.outputBlob,name:item.outputName}));
  if (!files.length) return;
  if (files.length >= 65535 || files.some((f)=>f.blob.size > 0xffffffff)) { toast('ZIP biçimi için dosya sayısı/boyutu destek sınırını aşıyor; dosyaları tek tek indir.',true); return; }
  const totalBytes = files.reduce((sum,file)=>sum+file.blob.size,0);
  if (totalBytes > MAX_ZIP_BYTES) { toast('Toplu ZIP bellek sınırını (128 MB) aşıyor; çıktıları tek tek indirin.',true); return; }
  $('#download-all').disabled=true; $('#download-all').textContent='ZIP HAZIRLANIYOR…';
  try { const zip=await makeZip(files);downloadBlob(zip,`formatlab-${new Date().toISOString().slice(0,10)}.zip`); }
  catch(error){toast(`ZIP hazırlanamadı: ${error.message}`,true);}
  finally { $('#download-all').innerHTML='TÜMÜNÜ ZIP İNDİR <b>↓</b>'; updateCounts(); }
}

function removeItem(id) {
  const item=state.items.find((x)=>x.id===id);if(!item||state.running)return;
  if(item.metadata.url)URL.revokeObjectURL(item.metadata.url);state.items=state.items.filter((x)=>x.id!==id);renderQueue();updateCounts();refreshFormatMenu();
}
function clearQueue() {
  if(state.running)return;state.items.forEach((item)=>{if(item.metadata.url)URL.revokeObjectURL(item.metadata.url);});state.items=[];renderQueue();updateCounts();refreshFormatMenu();
}

dropzone.addEventListener('click',(event)=>{if(event.target.closest('button'))return;fileInput.click();});
dropzone.addEventListener('keydown',(event)=>{if((event.key==='Enter'||event.key===' ')&&event.target===dropzone){event.preventDefault();fileInput.click();}});
$('#choose-files').addEventListener('click',(event)=>{event.stopPropagation();fileInput.click();});
fileInput.addEventListener('change',(event)=>addFiles(event.target.files));
for(const eventName of ['dragenter','dragover'])dropzone.addEventListener(eventName,(event)=>{event.preventDefault();dropzone.classList.add('dragging');});
for(const eventName of ['dragleave','drop'])dropzone.addEventListener(eventName,(event)=>{event.preventDefault();dropzone.classList.remove('dragging');});
dropzone.addEventListener('drop',(event)=>addFiles(event.dataTransfer.files));
document.querySelectorAll('.kind-button').forEach((button)=>button.addEventListener('click',()=>setActiveKind(button.dataset.kind)));
targetSelect.addEventListener('change',()=>{
  const [kind,format]=targetSelect.value.split(':');if(kind==='image')state.imageFormat=format;else if(kind==='video')state.videoFormat=format;
  if(kind==='image'&&format==='png')state.qualityMode='lossless';else state.qualityMode='highest';
  updateQualityAvailability();updateFormatHint();updateEstimate();renderQueue();
});
$('#codec').addEventListener('change',()=>{state.videoCodec=$('#codec').value;state.videoMime=chooseVideoMime(state.videoCodec);updateEngineStatus();refreshFormatMenu();updateFormatHint();updateEstimate();renderQueue();});
$('#lossless-button').addEventListener('click',()=>{if(!$('#lossless-button').disabled){state.qualityMode='lossless';updateQualityAvailability();}});
$('#quality-button').addEventListener('click',()=>{state.qualityMode='highest';updateQualityAvailability();});
$('#quality-range').addEventListener('input',()=>{$('#quality-value').textContent=$('#quality-range').value;updateEstimate();});
for(const id of ['resolution','fps','bitrate','transparent-bg'])$(`#${id}`).addEventListener('change',updateEstimate);
$('#convert-button').addEventListener('click',convertQueue);$('#clear-button').addEventListener('click',clearQueue);$('#download-all').addEventListener('click',downloadCompletedZip);
queueList.addEventListener('click',(event)=>{const remove=event.target.closest('[data-remove]');const download=event.target.closest('[data-download]');if(remove)removeItem(remove.dataset.remove);if(download){const item=state.items.find((x)=>x.id===download.dataset.download);if(item?.outputBlob)downloadBlob(item.outputBlob,item.outputName);}});

window.addEventListener('beforeinstallprompt',(event)=>{event.preventDefault();state.installPrompt=event;$('#install-button').hidden=false;});
$('#install-button').addEventListener('click',async()=>{if(!state.installPrompt)return;state.installPrompt.prompt();await state.installPrompt.userChoice;state.installPrompt=null;$('#install-button').hidden=true;});
window.addEventListener('appinstalled',()=>toast('FormatLab cihazına yüklendi.'));

(async()=>{
  for(const format of allFormats.image){if(await supportsImageEncoder(format.mime))state.imageEncoders.add(format.mime);}
  for(const option of $('#codec').options){if(option.value!=='auto')option.disabled=!chooseVideoMime(option.value);}
  state.videoMime=chooseVideoMime();
  updateEngineStatus();refreshFormatMenu();updateQualityAvailability();
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').then(async()=>{
    try {
      await navigator.serviceWorker.ready;
      const candidates=[...document.querySelectorAll('script[src],link[rel="stylesheet"],link[rel="manifest"]')].map((element)=>element.src||element.href).filter((url)=>url&&new URL(url).origin===location.origin);
      const cache=await caches.open('formatlab-shell-v1');
      for(const url of new Set(['/',...candidates])){try{const response=await fetch(url);if(response.ok)await cache.put(url,response.clone());}catch{}}
    } catch {}
  }).catch(()=>{});
  $('#engine-status-text').textContent=state.videoMime?`Yerel · ${state.videoMime.split(';')[1]?.trim() || 'WebM'}`:'Yerel görsel motoru · video WebM yok';
})();
