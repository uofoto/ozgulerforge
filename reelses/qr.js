// Minimal QR kod uretici (bayt modu, hata duzeltme M, surum 1-10). Yerel, internet gerektirmez.
var QR = (function () {
  var ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];   // blok basina ECC kod sozcugu (M)
  var BLK = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];             // blok sayisi (M)
  function rawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function dataWords(v) { return Math.floor(rawModules(v) / 8) - ECC[v] * BLK[v]; }
  function alignPos(v) {
    if (v === 1) return [];
    var n = Math.floor(v / 7) + 2, size = v * 4 + 17;
    var step = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, res = [6];
    for (var p = size - 7; res.length < n; p -= step) res.splice(1, 0, p);
    return res;
  }
  function mul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
    return z;
  }
  function rsDiv(deg) {
    var r = []; for (var i = 0; i < deg - 1; i++) r.push(0); r.push(1);
    var root = 1;
    for (i = 0; i < deg; i++) {
      for (var j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      root = mul(root, 2);
    }
    return r;
  }
  function rsRem(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ r.shift(); r.push(0);
      div.forEach(function (c, i) { r[i] ^= mul(c, f); });
    });
    return r;
  }
  function utf8(s) {
    var e = unescape(encodeURIComponent(s)), a = [];
    for (var i = 0; i < e.length; i++) a.push(e.charCodeAt(i));
    return a;
  }
  function encode(text) {
    var bytes = utf8(text), ver, cap;
    for (ver = 1; ver <= 10; ver++) {
      var cc = ver <= 9 ? 8 : 16;
      if (4 + cc + bytes.length * 8 <= dataWords(ver) * 8) break;
    }
    if (ver > 10) throw new Error('Metin QR icin cok uzun');
    var ccBits = ver <= 9 ? 8 : 16, bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, ccBits); bytes.forEach(function (b) { put(b, 8); });
    var capBits = dataWords(ver) * 8;
    put(0, Math.min(4, capBits - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < capBits; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) {
      var v = 0; for (var k = 0; k < 8; k++) v = (v << 1) | bits[i + k]; data.push(v);
    }
    // ECC ekle ve araya yerlestir
    var nb = BLK[ver], eccLen = ECC[ver], raw = Math.floor(rawModules(ver) / 8);
    var nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), blocks = [], div = rsDiv(eccLen);
    for (var b = 0, kk = 0; b < nb; b++) {
      var dl = shortLen - eccLen + (b < nShort ? 0 : 1);
      var d = data.slice(kk, kk + dl); kk += dl;
      var ecc = rsRem(d, div);
      if (b < nShort) d.push(0);
      blocks.push(d.concat(ecc));
    }
    var all = [];
    for (i = 0; i < blocks[0].length; i++) {
      blocks.forEach(function (bl, j) { if (i !== shortLen - eccLen || j >= nShort) all.push(bl[i]); });
    }
    // matris
    var size = ver * 4 + 17, m = [], fn = [];
    for (i = 0; i < size; i++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function set(x, y, c) { m[y][x] = c; fn[y][x] = true; }
    for (i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var dist = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    var ap = alignPos(ver), na = ap.length;
    for (i = 0; i < na; i++) for (var j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++)
        set(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    function fmt(mask) {
      var d = (0 << 3) | mask, rem = d;           // M duzeyi = 0
      for (var q = 0; q < 10; q++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bt = ((d << 10) | rem) ^ 0x5412;
      function bit(n) { return ((bt >>> n) & 1) !== 0; }
      for (var q = 0; q <= 5; q++) set(8, q, bit(q));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (q = 9; q < 15; q++) set(14 - q, 8, bit(q));
      for (q = 0; q < 8; q++) set(size - 1 - q, 8, bit(q));
      for (q = 8; q < 15; q++) set(8, size - 15 + q, bit(q));
      set(8, size - 8, true);
    }
    function verBits() {
      if (ver < 7) return;
      var rem = ver;
      for (var q = 0; q < 12; q++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var bt = (ver << 12) | rem;
      for (q = 0; q < 18; q++) {
        var c = ((bt >>> q) & 1) !== 0, a = size - 11 + q % 3, bb = Math.floor(q / 3);
        set(a, bb, c); set(bb, a, c);
      }
    }
    fmt(0); verBits();
    // veri sozcuklerini yerlestir
    var idx = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && idx < all.length * 8) { m[y][x] = ((all[idx >>> 3] >>> (7 - (idx & 7))) & 1) !== 0; idx++; }
      }
    }
    function mask(mk) {
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        var inv;
        switch (mk) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = x * y % 2 + x * y % 3 === 0; break;
          case 6: inv = (x * y % 2 + x * y % 3) % 2 === 0; break;
          default: inv = ((x + y) % 2 + x * y % 3) % 2 === 0;
        }
        if (!fn[y][x] && inv) m[y][x] = !m[y][x];
      }
    }
    function penalty() {
      var p = 0, y, x, run, dark = 0;
      for (var pass = 0; pass < 2; pass++) for (y = 0; y < size; y++) {
        run = 1;
        for (x = 1; x < size; x++) {
          var a = pass ? m[x][y] : m[y][x], b = pass ? m[x - 1][y] : m[y][x - 1];
          if (a === b) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
        }
      }
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
        if (m[y][x]) dark++;
        if (x < size - 1 && y < size - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
      }
      p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    }
    var best = 0, bestP = Infinity;
    for (var mk = 0; mk < 8; mk++) {
      mask(mk); fmt(mk);
      var pn = penalty(); if (pn < bestP) { bestP = pn; best = mk; }
      mask(mk);
    }
    mask(best); fmt(best);
    return { size: size, modules: m };
  }
  // canvas'a ciz (sessiz bolge 4 modul)
  function draw(canvas, text, px) {
    var q = encode(text), n = q.size + 8;
    canvas.width = canvas.height = n * px;
    var c = canvas.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = '#000';
    for (var y = 0; y < q.size; y++) for (var x = 0; x < q.size; x++)
      if (q.modules[y][x]) c.fillRect((x + 4) * px, (y + 4) * px, px, px);
  }
  return { encode: encode, draw: draw };
})();
if (typeof module !== 'undefined') module.exports = QR;
