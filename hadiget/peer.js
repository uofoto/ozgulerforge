// WebRTC bağlantısı ve dosya aktarım protokolü.
//
// Tek bir güvenilir, sıralı veri kanalı kullanılır. Kanaldan iki tür ileti geçer:
//   - metin (JSON):  {t:'meta',name,size,type} → dosya başlıyor
//                    {t:'end'}                 → dosya bitti
//                    {t:'text',v}              → kısa metin
//   - ikili: dosya parçaları (16 KB)

import { descToCode, codeToDesc } from './signal.js';

const CHUNK = 16 * 1024; // tarayıcılar arası en güvenli ileti boyutu
const SLICE = 1024 * 1024; // diskten tek seferde okunan miktar
const HIGH = 4 * 1024 * 1024; // gönderim tamponu bunu aşarsa bekle
const LOW = 1024 * 1024; // tampon bunun altına inince devam et
const STUN = 'stun:stun.l.google.com:19302';

export class Peer {
  constructor(opts = {}) {
    this.o = opts;
    this.dc = null;
    this.incoming = null;
    this.chain = Promise.resolve();
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
  sendFile(file, onProgress) {
    const run = () => this._sendFile(file, onProgress);
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => {});
    return p;
  }

  async _sendFile(file, onProgress) {
    this._need();
    const dc = this.dc;
    dc.send(JSON.stringify({ t: 'meta', name: file.name, size: file.size, type: file.type }));
    let off = 0;
    while (off < file.size) {
      const buf = await file.slice(off, off + SLICE).arrayBuffer();
      for (let i = 0; i < buf.byteLength; i += CHUNK) {
        await this._drain();
        dc.send(new Uint8Array(buf, i, Math.min(CHUNK, buf.byteLength - i)));
      }
      off += buf.byteLength;
      onProgress?.(off / file.size);
    }
    dc.send(JSON.stringify({ t: 'end' }));
    if (file.size === 0) onProgress?.(1);
  }

  _need() {
    if (!this.dc || this.dc.readyState !== 'open') throw new Error('Bağlantı kapalı.');
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
        this.incoming = { name: String(m.name || 'dosya'), size: +m.size || 0, type: String(m.type || ''), chunks: [], got: 0 };
        this.o.onIncoming?.(this.incoming);
      } else if (m.t === 'end') {
        const f = this.incoming;
        this.incoming = null;
        if (!f) return;
        if (f.got !== f.size) {
          this.o.onError?.(f, new Error('Dosya eksik geldi.'));
        } else {
          this.o.onFile?.(f, new Blob(f.chunks, { type: f.type }));
        }
      } else if (m.t === 'text') {
        this.o.onText?.(String(m.v));
      }
    } else if (this.incoming) {
      const f = this.incoming;
      f.chunks.push(e.data);
      f.got += e.data.byteLength;
      this.o.onProgress?.(f);
    }
  }
}
