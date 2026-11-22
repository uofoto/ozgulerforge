// WebRTC bağlantısı ve dosya aktarım protokolü.
//
// Tek bir güvenilir, sıralı veri kanalı kullanılır. Kanaldan iki tür ileti geçer:
//   - metin (JSON):  {t:'meta',id,name,size,type} → dosya başlıyor
//                    {t:'end',id}                 → dosya bitti
//                    {t:'cancel-send',id}         → gönderen vazgeçti
//                    {t:'cancel-recv',id}         → alan vazgeçti, gönderme dursun
//                    {t:'text',v}                 → kısa metin
//   - ikili: dosya parçaları (16 KB)
//
// Büyük dosyalar (OPFS varsa) belleğe değil, tarayıcının özel disk alanına yazılır;
// böylece birkaç GB'lık dosyalar da alınabilir.

import { descToCode, codeToDesc } from './signal.js';
import { t } from './i18n.js';

const CHUNK = 16 * 1024; // tarayıcılar arası en güvenli ileti boyutu
const SLICE = 1024 * 1024; // diskten tek seferde okunan miktar
const HIGH = 4 * 1024 * 1024; // gönderim tamponu bunu aşarsa bekle
const LOW = 1024 * 1024; // tampon bunun altına inince devam et
const OPFS_MIN = 64 * 1024 * 1024; // bundan büyük dosyalar diske yazılır
const VERIFY_CHUNK = 4 * 1024 * 1024; // SHA-256 doğrulama bloğu (4 MB)
const INBOX = 'hadiget-inbox';
const STUN = 'stun:stun.l.google.com:19302';

// --- alınan dosyanın depolanması ----------------------------------------

function memorySink(type) {
  const chunks = [];
  return {
    write: (b) => void chunks.push(b),
    finish: async () => new Blob(chunks, { type }),
    abort: async () => { chunks.length = 0; },
    cleanup: () => {},
  };
}

async function opfsSink(type, id) {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle(INBOX, { create: true });
  const fname = `${id}-${Math.random().toString(36).slice(2)}`;
  const fh = await dir.getFileHandle(fname, { create: true });
  const w = await fh.createWritable(); // eski Safari'de yok → çağıran belleğe düşer
  const rm = async () => { try { await dir.removeEntry(fname); } catch {} };
  return {
    write: (b) => w.write(b),
    finish: async () => {
      await w.close();
      const f = await fh.getFile();
      return f.slice(0, f.size, type); // diske dayalı Blob, belleğe yüklenmez
    },
    abort: async () => { try { await w.abort(); } catch {} await rm(); },
    cleanup: rm,
  };
}

async function makeSink(meta) {
  if (meta.size >= OPFS_MIN && navigator.storage?.getDirectory) {
    try { return await opfsSink(meta.type, meta.id); } catch {}
  }
  return memorySink(meta.type);
}

// WebCrypto tek seferde hash aldığı için dosyayı 1 MB bloklarla doğrula.
// Böylece GB boyutundaki dosyanın tamamını belleğe almak gerekmez.
async function hashFileChunks(file) {
  const hashes = [];
  for (let off = 0; off < file.size; off += VERIFY_CHUNK) {
    const bytes = await file.slice(off, off + VERIFY_CHUNK).arrayBuffer();
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    hashes.push([...digest].map((b) => b.toString(16).padStart(2, '0')).join(''));
  }
  return hashes;
}

function hexDigest(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Önceki oturumlardan kalan geçici dosyaları sil (6 saatten eskiler).
export async function cleanInbox() {
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(INBOX);
    for await (const [name, h] of dir.entries()) {
      try {
        const f = await h.getFile();
        if (Date.now() - f.lastModified > 6 * 3600 * 1000) await dir.removeEntry(name);
      } catch {}
    }
  } catch {}
}

export class Peer {
  constructor(opts = {}) {
    this.o = opts;
    this.dc = null;
    this.incoming = null;
    this.chain = Promise.resolve();
    this.seq = 0;
    this.cur = null; // şu an gönderilen aktarım
    this.closed = false;
    this.pc = new RTCPeerConnection({
      iceServers: opts.stun ? [{ urls: STUN }] : [],
    });
    this.pc.onconnectionstatechange = () => {
      const s = this.pc.connectionState;
      // 'disconnected' geçici olabilir, kendiliğinden toparlanır; saymıyoruz.
      if (s === 'failed' || s === 'closed') this._lost();
    };
  }

  // --- eşleşme ---------------------------------------------------------

  async createOffer() {
    this._setup(this.pc.createDataChannel('aktar', { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await this._gather();
    return descToCode(this.pc.localDescription);
  }

  async acceptOffer(code) {
    this.pc.ondatachannel = (e) => this._setup(e.channel);
    await this.pc.setRemoteDescription(codeToDesc(code));
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await this._gather();
    return descToCode(this.pc.localDescription);
  }

  async acceptAnswer(code) {
    await this.pc.setRemoteDescription(codeToDesc(code));
  }

  _gather() {
    if (this.pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.pc.removeEventListener('icegatheringstatechange', onChange);
        resolve();
      };
      const onChange = () => {
        if (this.pc.iceGatheringState === 'complete') done();
      };
      const timer = setTimeout(done, 4000);
      this.pc.addEventListener('icegatheringstatechange', onChange);
    });
  }

  _setup(dc) {
    this.dc = dc;
    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = LOW;
    dc.onopen = () => this.o.onOpen?.();
    dc.onclose = () => this._lost();
    dc.onmessage = (e) => this._onMessage(e);
  }

  _lost() {
    if (this.closed) return;
    this.closed = true;
    this.o.onClose?.();
  }

  close() {
    this.closed = true;
    try { this.dc?.close(); } catch {}
    try { this.pc.close(); } catch {}
  }

  // --- gönderme --------------------------------------------------------

  sendText(v) {
    this._need();
    this.dc.send(JSON.stringify({ t: 'text', v }));
  }

  // Dosyalar sırayla gider; aynı anda iki dosya birbirine karışmaz.
  // Dönen nesne: { id, cancel(), done: Promise }. İptalde done, .cancelled alanlı bir hatayla biter.
  sendFile(file, onProgress) {
    const tr = { id: String(++this.seq), cancelled: false, byPeer: false };
    tr.cancel = () => {
      if (tr.cancelled) return;
      tr.cancelled = true;
      if (this.cur === tr) {
        try { this.dc.send(JSON.stringify({ t: 'cancel-send', id: tr.id })); } catch {}
      }
    };
    const run = () => this._sendFile(tr, file, onProgress);
    tr.done = this.chain.then(run, run);
    this.chain = tr.done.catch(() => {});
    return tr;
  }

  async _sendFile(tr, file, onProgress) {
    const stop = () => {
      const e = new Error('cancelled');
      e.cancelled = true;
      e.byPeer = tr.byPeer;
      return e;
    };
    if (tr.cancelled) throw stop();
    this._need();
    const dc = this.dc;
    this.cur = tr;
    try {
      // Aktarım başlamadan önce blok özetlerini hesapla; alıcı her bloğu
      // diske yazmadan önce doğrulayabilir.
      const hashes = await hashFileChunks(file);
      if (tr.cancelled) throw stop();
      dc.send(JSON.stringify({ t: 'meta', id: tr.id, name: file.name, size: file.size, type: file.type, verifyChunk: VERIFY_CHUNK, hashes }));
      tr.onStart?.();
      let off = 0;
      while (off < file.size) {
        if (tr.cancelled) throw stop();
        const buf = await file.slice(off, off + SLICE).arrayBuffer();
        for (let i = 0; i < buf.byteLength; i += CHUNK) {
          await this._drain();
          if (tr.cancelled) throw stop();
          dc.send(new Uint8Array(buf, i, Math.min(CHUNK, buf.byteLength - i)));
        }
        off += buf.byteLength;
        onProgress?.(off / file.size);
      }
      if (tr.cancelled) throw stop();
      dc.send(JSON.stringify({ t: 'end', id: tr.id }));
      if (file.size === 0) onProgress?.(1);
    } finally {
      if (this.cur === tr) this.cur = null;
    }
  }

  // Gelen dosyadan vazgeç.
  cancelIncoming(f) {
    if (this.incoming !== f) return;
    this.incoming = null;
    f.dead = true;
    try { this.dc.send(JSON.stringify({ t: 'cancel-recv', id: f.id })); } catch {}
    f.q.then(() => f.sink?.abort());
  }

  _need() {
    if (!this.dc || this.dc.readyState !== 'open') throw new Error(t('err.closed'));
  }

  async _drain() {
    const dc = this.dc;
    while (dc.bufferedAmount > HIGH) {
      this._need();
      await new Promise((resolve) => {
        dc.onbufferedamountlow = () => {
          dc.onbufferedamountlow = null;
          resolve();
        };
        // tampon beklenmedik şekilde boşalmışsa takılı kalma
        setTimeout(resolve, 500);
      });
    }
  }

  // --- alma ------------------------------------------------------------

  _onMessage(e) {
    if (typeof e.data === 'string') {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'meta') {
        const f = { id: String(m.id ?? ''), name: String(m.name || t('tr.fileDefault')), size: +m.size || 0, type: String(m.type || ''), got: 0, dead: false, sink: null,
          verifyChunk: Number(m.verifyChunk) === VERIFY_CHUNK ? VERIFY_CHUNK : 0,
          hashes: Array.isArray(m.hashes) ? m.hashes : [], verifyBuffer: new Uint8Array(VERIFY_CHUNK), verifyUsed: 0, verifyIndex: 0, verifyFailed: false };
        // Yeni istemcilerde SHA-256 blok doğrulaması zorunlu; eski sürümle
        // geriye dönük bağlantı için doğrulama alanları yoksa aktarım sürer.
        if (f.verifyChunk && f.hashes.length !== Math.ceil(f.size / VERIFY_CHUNK)) f.verifyFailed = true;
        f.q = makeSink(f).then((s) => { f.sink = s; });
        this.incoming = f;
        this.o.onIncoming?.(f);
      } else if (m.t === 'end') {
        const f = this.incoming;
        if (!f || (m.id !== undefined && String(m.id) !== f.id)) return;
        this.incoming = null;
        if (f.got !== f.size) {
          f.q.then(() => f.sink?.abort());
          this.o.onError?.(f, new Error(t('err.incomplete')));
          return;
        }
        f.q = f.q.then(async () => {
          if (f.dead) return;
          try {
            if (f.verifyChunk && f.verifyUsed) {
              const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', f.verifyBuffer.slice(0, f.verifyUsed)));
              if (hexDigest(digest) !== f.hashes[f.verifyIndex]) f.verifyFailed = true;
              f.verifyIndex++;
              f.verifyUsed = 0;
            }
            if (f.verifyChunk && (f.verifyFailed || f.verifyIndex !== f.hashes.length)) {
              await f.sink.abort();
              this.o.onError?.(f, new Error(t('err.integrity')));
              return;
            }
            const blob = await f.sink.finish();
            f.cleanup = f.sink.cleanup;
            this.o.onFile?.(f, blob);
          } catch (err) {
            this.o.onError?.(f, new Error(t('err.disk')));
          }
        });
      } else if (m.t === 'cancel-send') {
        const f = this.incoming;
        if (f && f.id === String(m.id)) {
          this.incoming = null;
          f.dead = true;
          f.q.then(() => f.sink?.abort());
          this.o.onCancelled?.(f);
        }
      } else if (m.t === 'cancel-recv') {
        if (this.cur && this.cur.id === String(m.id)) {
          this.cur.byPeer = true;
          this.cur.cancelled = true;
        }
      } else if (m.t === 'text') {
        this.o.onText?.(String(m.v));
      }
    } else if (this.incoming) {
      const f = this.incoming;
      f.got += e.data.byteLength;
      const buf = e.data;
      f.q = f.q.then(async () => {
        if (f.dead) return;
        try {
          if (f.verifyChunk) {
            let pos = 0;
            while (pos < buf.byteLength) {
              const take = Math.min(f.verifyChunk - f.verifyUsed, buf.byteLength - pos);
              f.verifyBuffer.set(new Uint8Array(buf, pos, take), f.verifyUsed);
              f.verifyUsed += take;
              pos += take;
              if (f.verifyUsed === f.verifyChunk) {
                const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', f.verifyBuffer));
                if (hexDigest(digest) !== f.hashes[f.verifyIndex]) f.verifyFailed = true;
                f.verifyIndex++;
                f.verifyUsed = 0;
              }
            }
          }
          await f.sink.write(buf);
        } catch {
          if (f.dead) return;
          f.dead = true;
          if (this.incoming === f) this.incoming = null;
          try { this.dc.send(JSON.stringify({ t: 'cancel-recv', id: f.id })); } catch {}
          await f.sink.abort();
          this.o.onError?.(f, new Error(t('err.disk')));
        }
      });
      this.o.onProgress?.(f);
    }
  }
}
