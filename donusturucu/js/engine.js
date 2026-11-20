// ffmpeg.wasm sarmalayıcısı: yükleme, yetenek tespiti, probe, dönüştürme ve bit-bit doğrulama.
import { FFmpeg } from '../vendor/ffmpeg/index.js';

const CORE = new URL('../vendor/core/ffmpeg-core.js', import.meta.url).href;
const WASM = new URL('../vendor/core/ffmpeg-core.wasm', import.meta.url).href;
// Yerel wasm yoksa (32 MB, GitHub web yüklemesi 25 MB'ı geçemez) aynı sürümün CDN kopyası kullanılır.
const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.9/dist/esm/ffmpeg-core.wasm';

// Sunucu eksik dosya için 200 + HTML döndürebilir (SPA yedeği). Başlık sorgusuyla gerçek wasm olup olmadığına bakılır.
export async function pickWasm() {
  try {
    const r = await fetch(WASM, { method: 'HEAD', cache: 'no-cache' });
    if (r.ok && !/text\/html/i.test(r.headers.get('content-type') || '')) return { url: WASM, source: 'yerel' };
  } catch {}
  return { url: WASM_CDN, source: 'cdn' };
}

export class Engine {
  constructor() {
    this.ff = null; this.caps = null; this.sink = null; this.onProgress = null; this.mounts = new Set();
  }

  async boot(wasmURL) {
    this.ff = new FFmpeg();
    this.ff.on('log', e => { if (this.sink) this.sink.push(e); });
    this.ff.on('progress', p => { if (this.onProgress) this.onProgress(Math.max(0, Math.min(1, p.progress))); });
    await this.ff.load({ coreURL: CORE, wasmURL });
  }

  async start() {
    if (!this.wasm) this.wasm = await pickWasm();
    try { await this.boot(this.wasm.url); }
    catch (e) {
      if (this.wasm.source !== 'yerel') throw e;
      try { this.ff.terminate(); } catch {}
      this.wasm = { url: WASM_CDN, source: 'cdn' }; // yerel wasm bozuksa CDN'e geç
      await this.boot(this.wasm.url);
    }
    await this.ff.createDir('/out');
    this.mounts.clear();
  }

  async load() {
    await this.start();
    if (!this.caps) {
      this.crashed = false;
      this.caps = await this.detect();
      if (this.crashed) { // deneme kodlaması çekirdeği bozduysa temiz bir çekirdekle devam et
        try { this.ff.terminate(); } catch {}
        await this.start();
      }
    }
    return this.caps;
  }

  // İptal veya çökme sonrası motoru yeniden başlat. İptal düğmesi ile çöken komutun hata yolu aynı anda
  // reset() çağırabilir; ikinci çağrı, yükleniyor olan yeni çekirdeği öldürmesin diye aynı işe katılır.
  reset() {
    if (!this._resetting) {
      this._resetting = (async () => {
        try { this.ff.terminate(); } catch {}
        await this.start();
      })().finally(() => { this._resetting = null; });
    }
    return this._resetting;
  }

  async run(args) {
    const lines = []; this.sink = lines;
    let code;
    try { code = await this.ff.exec(args); }
    catch (e) { const err = new Error(e?.message || String(e) || 'ffmpeg çöktü'); err.fault = true; throw err; }
    finally { this.sink = null; }
    return { code, log: lines.map(l => l.message).join('\n') };
  }

  // ffprobe günlükleri stdout'a karıştığı için sonuç -o ile dosyaya yazılır.
  async runProbe(args) {
    const out = '/out/_probe_' + (this.probeN = (this.probeN || 0) + 1) + '.txt';
    this.sink = [];
    try { await this.ff.ffprobe(['-v', 'quiet', ...args, '-o', out]); } finally { this.sink = null; }
    try { const t = new TextDecoder().decode(await this.ff.readFile(out)); await this.rm(out); return t; } catch { return ''; }
  }

  async detect() {
    const caps = { encoders: new Set(), muxers: new Set(), ver: 5.1, x264_10: false, vp9_10: false, vp9_444: false };
    const ver = await this.run(['-hide_banner', '-version']);
    const m = ver.log.match(/version\s+n?(\d+)\.(\d+)/);
    if (m) caps.ver = parseFloat(m[1] + '.' + m[2]);
    caps.versionText = (ver.log.match(/version\s+\S+/) || [''])[0];
    const e = await this.run(['-hide_banner', '-encoders']);
    for (const l of e.log.split('\n')) { const mm = l.match(/^\s*[VAS][\.A-Z]{5}\s+(\S+)/); if (mm) caps.encoders.add(mm[1]); }
    const mx = await this.run(['-hide_banner', '-muxers']);
    for (const l of mx.log.split('\n')) { const mm = l.match(/^\s*[D\s]E\s+(\S+)/); if (mm) caps.muxers.add(mm[1]); }
    // Küçük deneme kodlamaları: 10 bit ve 4:4:4 desteği.
    const t = async (pf, enc, extra, out) => {
      try {
        const r = await this.run(['-f', 'lavfi', '-i', 'color=c=gray:s=64x64:d=0.1:r=10', '-pix_fmt', pf, '-c:v', enc, ...extra, '-f', out, '/out/_probe.bin']);
        try { await this.ff.deleteFile('/out/_probe.bin'); } catch {}
        return r.code === 0;
      } catch { this.crashed = true; return false; }
    };
    if (caps.encoders.has('libx264')) caps.x264_10 = await t('yuv420p10le', 'libx264', ['-qp', '0', '-preset', 'ultrafast'], 'matroska');
    return caps;
  }

  /* ----- Dosya erişimi ----- */
  async mountInput(id, file) {
    const dir = '/in_' + id;
    await this.unmountInput(id); // önceki bağlama varsa temizle; createDir "dosya var" hatası vermesin
    const ext = (file.name.match(/\.[A-Za-z0-9]+$/) || [''])[0];
    const f = new File([file], 'src' + ext);
    await this.ff.createDir(dir);
    await this.ff.mount('WORKERFS', { files: [f] }, dir);
    this.mounts.add(dir);
    return dir + '/' + f.name;
  }
  async unmountInput(id) {
    const dir = '/in_' + id;
    if (!this.mounts.has(dir)) return;
    try { await this.ff.unmount(dir); } catch {}
    try { await this.ff.deleteDir(dir); } catch {}
    this.mounts.delete(dir);
  }
  async readOut(path) { const d = await this.ff.readFile(path); return d instanceof Uint8Array ? d : new TextEncoder().encode(d); }
  async rm(path) { try { await this.ff.deleteFile(path); } catch {} }
  async rmDir(path) {
    try {
      for (const n of await this.ff.listDir(path)) if (!n.isDir) await this.rm(path + '/' + n.name);
      await this.ff.deleteDir(path);
    } catch {}
  }

  /* ----- Probe ----- */
  async probe(path, file) {
    const out = await this.runProbe(['-show_format', '-show_streams', '-of', 'json', path]);
    let j;
    try { j = JSON.parse(out); } catch { throw new Error('Dosya çözümlenemedi (desteklenmeyen veya bozuk format).'); }
    const info = {
      format: (j.format?.format_name || '').split(',')[0],
      formatLong: j.format?.format_long_name || '',
      duration: parseFloat(j.format?.duration) || 0,
      streams: (j.streams || []).map(s => ({
        index: s.index, type: s.codec_type, codec: s.codec_name, pixFmt: s.pix_fmt, width: s.width, height: s.height,
        fps: s.avg_frame_rate, sampleFmt: s.sample_fmt, channels: s.channels, rate: s.sample_rate,
        bits: parseInt(s.bits_per_raw_sample || s.bits_per_sample) || 0, attached: s.disposition?.attached_pic === 1,
      })),
    };
    if (info.format === 'gif') {
      const c = await this.runProbe(['-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', path]);
      info.frameCount = parseInt(c) || 1;
    }
    if (info.format === 'webp_pipe' && file) {
      // Animasyon bayrağı yalnız genişletilmiş (VP8X) başlıkta bulunur. Sade 'VP8 ' / 'VP8L' dosyalarında
      // 20. bayt görüntü verisidir; oradaki bit durmadan sahte "hareketli" sonucu verirdi.
      const h = new Uint8Array(await file.slice(0, 32).arrayBuffer());
      const fourcc = String.fromCharCode(...h.slice(12, 16));
      if (h.length > 20 && fourcc === 'VP8X' && (h[20] & 0x02)) info.animatedWebp = true;
    }
    return info;
  }

  /* ----- Doğrulama ----- */
  async frameHashes(inputArgs, map, pix, pass, tag, vf) {
    const out = `/out/_${tag}.md5`;
    const args = ['-noautorotate', ...inputArgs, '-map', map, '-an', '-sn', '-dn', ...(vf ? ['-vf', vf] : []), ...(pix ? ['-pix_fmt', pix] : []), ...pass, '-f', 'framemd5', out];
    const r = await this.run(args);
    if (r.code !== 0) throw new Error('Doğrulama çözümlemesi başarısız: ' + r.log.split('\n').slice(-3).join(' '));
    const text = new TextDecoder().decode(await this.readOut(out));
    await this.rm(out);
    return text.split('\n').filter(l => l && l[0] !== '#').map(l => { const p = l.split(',').map(s => s.trim()); return p[p.length - 2] + ':' + p[p.length - 1]; });
  }
  async audioHash(inputArgs, map, tag) {
    const out = `/out/_${tag}.md5`;
    const r = await this.run([...inputArgs, '-map', map, '-vn', '-sn', '-dn', '-c:a', 'pcm_s32le', '-f', 'md5', out]);
    if (r.code !== 0) throw new Error('Ses doğrulaması başarısız.');
    const t = new TextDecoder().decode(await this.readOut(out)); await this.rm(out);
    return t.trim();
  }
}
