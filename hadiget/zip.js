// Sıkıştırmasız ("store") ZIP üretir. Dosyalar belleğe yüklenmez: sonuç, dosya
// Blob'larına başvuran parçalardan kurulur. CRC32 için dosyalar parça parça okunur.
// Zip64 yok: toplam 4 GB'ı aşarsa hata verir.

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32Update(crc, bytes) {
  let c = crc;
  for (let i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return c;
}

async function crcOf(file, onBytes) {
  let c = 0xffffffff;
  for (let off = 0; off < file.size; off += 1 << 20) {
    const buf = new Uint8Array(await file.slice(off, off + (1 << 20)).arrayBuffer());
    c = crc32Update(c, buf);
    onBytes?.(buf.length);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(ms) {
  const d = new Date(ms || Date.now());
  const y = Math.max(1980, d.getFullYear());
  return [
    (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  ];
}

// entries: [{ name, file }]  →  Blob (application/zip)
export async function makeZip(entries, onProgress) {
  const total = entries.reduce((a, e) => a + e.file.size, 0);
  if (total > 0xf0000000 || entries.length > 65000) throw new Error('too-big');
  const enc = new TextEncoder();
  const seen = new Map();
  const parts = [];
  const central = [];
  let offset = 0;
  let done = 0;
  for (const e of entries) {
    let name = e.name.replace(/\\/g, '/').replace(/^\/+/, '');
    const n = seen.get(name) || 0;
    seen.set(name, n + 1);
    if (n) name = name.replace(/(\.[^./]+)?$/, ` (${n})$1`);
    const nb = enc.encode(name);
    const crc = await crcOf(e.file, (len) => onProgress?.((done += len) / (total || 1)));
    const [time, date] = dosTime(e.file.lastModified);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true); // UTF-8 dosya adı
    lh.setUint16(8, 0, true); // store
    lh.setUint16(10, time, true);
    lh.setUint16(12, date, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, e.file.size, true);
    lh.setUint32(22, e.file.size, true);
    lh.setUint16(26, nb.length, true);
    lh.setUint16(28, 0, true);
    parts.push(lh.buffer, nb, e.file);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, time, true);
    ch.setUint16(14, date, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, e.file.size, true);
    ch.setUint32(24, e.file.size, true);
    ch.setUint16(28, nb.length, true);
    ch.setUint32(42, offset, true);
    central.push(ch.buffer, nb);
    offset += 30 + nb.length + e.file.size;
  }
  const csize = central.reduce((a, b) => a + (b.byteLength ?? b.length), 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, csize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}
