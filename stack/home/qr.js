/*
  qr.js — a small QR code encoder, written from scratch.

  Why this exists: the nicest way to get Dad's library onto his iPad is to let
  him point the camera at the PC screen. That needs a QR code, and a QR code
  needs an encoder. Pulling one off a CDN would break the whole premise of this
  project (nothing leaves the house, nothing needs the internet), and vendoring
  a minified blob would leave nobody able to read it. So: byte mode, error
  correction level M, versions 1 through 10 — comfortably more than the ~30
  characters of "http://192.168.1.42:8080" needs, with room to spare.

  Deliberately written in the same plain style as the rest of the page, and
  exported both as a browser global and as a module so the test suite can hold
  it to account.

  Reference: ISO/IEC 18004. The tables below are from that spec; everything
  else (Reed-Solomon, masking, penalties) is computed rather than tabulated,
  so there is less to get wrong.
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MoonQR = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Total codewords — data plus error correction — for versions 1..10.
  var TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];

  // Error-correction level M, per version:
  //   [ecCodewordsPerBlock, group1Blocks, g1DataCw, group2Blocks, g2DataCw]
  // Level M recovers ~15% damage, which is the right trade for a code being
  // read off a glowing screen a foot away.
  var EC_M = [
    null,
    [10, 1, 16, 0, 0],
    [16, 1, 28, 0, 0],
    [26, 1, 44, 0, 0],
    [18, 2, 32, 0, 0],
    [24, 2, 43, 0, 0],
    [16, 4, 27, 0, 0],
    [18, 4, 31, 0, 0],
    [22, 2, 38, 2, 39],
    [22, 3, 36, 2, 37],
    [26, 4, 43, 1, 44]
  ];

  // Row/column centres of the little alignment squares, per version.
  var ALIGNMENT = [
    null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
    [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]
  ];

  var MAX_VERSION = 10;

  // ---------------------------------------------------------------------
  // GF(256) arithmetic — the field Reed-Solomon lives in.
  // ---------------------------------------------------------------------
  var EXP = new Uint8Array(512);
  var LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d; // the QR primitive polynomial
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function gmul(a, b) {
    return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];
  }

  // The generator polynomial for n error-correction codewords is simply
  // (x - a^0)(x - a^1)...(x - a^(n-1)) multiplied out.
  function generatorPoly(n) {
    var poly = [1];
    for (var i = 0; i < n; i++) {
      var next = [];
      for (var k = 0; k <= poly.length; k++) next.push(0);
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gmul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  // Polynomial long division; the remainder is the error-correction block.
  function ecCodewords(data, n) {
    var gen = generatorPoly(n);
    var res = data.slice();
    for (var i = 0; i < n; i++) res.push(0);
    for (i = 0; i < data.length; i++) {
      var factor = res[i];
      if (factor === 0) continue;
      for (var j = 0; j < gen.length; j++) res[i + j] ^= gmul(gen[j], factor);
    }
    return res.slice(data.length);
  }

  // ---------------------------------------------------------------------
  // Bit-level encoding of the payload.
  // ---------------------------------------------------------------------
  function toUtf8(text) {
    if (typeof TextEncoder === "function") {
      var enc = new TextEncoder().encode(text);
      return Array.prototype.slice.call(enc);
    }
    // Older-browser fallback: encodeURIComponent already produces UTF-8.
    var out = [];
    var esc = encodeURIComponent(text);
    for (var i = 0; i < esc.length; i++) {
      if (esc.charAt(i) === "%") {
        out.push(parseInt(esc.substr(i + 1, 2), 16));
        i += 2;
      } else {
        out.push(esc.charCodeAt(i));
      }
    }
    return out;
  }

  // Byte mode spends 8 bits on the length up to version 9, then 16.
  function charCountBits(version) { return version < 10 ? 8 : 16; }

  function dataCodewordCount(version) {
    var s = EC_M[version];
    return s[1] * s[2] + s[3] * s[4];
  }

  function pickVersion(byteLength) {
    for (var v = 1; v <= MAX_VERSION; v++) {
      var needed = 4 + charCountBits(v) + byteLength * 8;
      if (needed <= dataCodewordCount(v) * 8) return v;
    }
    return -1;
  }

  function dataCodewords(bytes, version) {
    var capacity = dataCodewordCount(version) * 8;
    var bits = [];

    function put(value, len) {
      for (var i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    }

    put(0x4, 4);                                  // byte mode
    put(bytes.length, charCountBits(version));
    for (var i = 0; i < bytes.length; i++) put(bytes[i], 8);

    // Terminator, then pad out to a whole number of codewords with the two
    // filler bytes the spec nominates.
    put(0, Math.min(4, capacity - bits.length));
    while (bits.length % 8 !== 0) bits.push(0);
    var pad = [0xec, 0x11], p = 0;
    while (bits.length < capacity) { put(pad[p], 8); p ^= 1; }

    var cw = [];
    for (i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      cw.push(b);
    }
    return cw;
  }

  // Data and error-correction codewords are woven together block by block so
  // that a scratch across the code damages a little of every block rather
  // than all of one.
  function interleave(cw, version) {
    var spec = EC_M[version];
    var ecLen = spec[0];
    var counts = [];
    var i, c;
    for (i = 0; i < spec[1]; i++) counts.push(spec[2]);
    for (i = 0; i < spec[3]; i++) counts.push(spec[4]);

    var blocks = [], ecBlocks = [], offset = 0;
    for (i = 0; i < counts.length; i++) {
      var block = cw.slice(offset, offset + counts[i]);
      offset += counts[i];
      blocks.push(block);
      ecBlocks.push(ecCodewords(block, ecLen));
    }

    var out = [];
    var longest = 0;
    for (i = 0; i < counts.length; i++) if (counts[i] > longest) longest = counts[i];
    for (c = 0; c < longest; c++)
      for (i = 0; i < blocks.length; i++)
        if (c < blocks[i].length) out.push(blocks[i][c]);
    for (c = 0; c < ecLen; c++)
      for (i = 0; i < ecBlocks.length; i++) out.push(ecBlocks[i][c]);
    return out;
  }

  // ---------------------------------------------------------------------
  // The matrix: function patterns, then data, then a mask.
  // ---------------------------------------------------------------------
  function blank(size) {
    var g = [];
    for (var r = 0; r < size; r++) {
      var row = [];
      for (var c = 0; c < size; c++) row.push(0);
      g.push(row);
    }
    return g;
  }

  function placeFinder(m, reserved, row, col, size) {
    for (var r = -1; r <= 7; r++) {
      for (var c = -1; c <= 7; c++) {
        var rr = row + r, cc = col + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        var edge = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                   (c >= 0 && c <= 6 && (r === 0 || r === 6));
        var core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        m[rr][cc] = (edge || core) ? 1 : 0;
        reserved[rr][cc] = 1;
      }
    }
  }

  function buildFunctionPatterns(version) {
    var size = version * 4 + 17;
    var m = blank(size), reserved = blank(size);
    var i, j;

    placeFinder(m, reserved, 0, 0, size);
    placeFinder(m, reserved, 0, size - 7, size);
    placeFinder(m, reserved, size - 7, 0, size);

    // Timing patterns: the dashed lines that let a scanner find its grid.
    for (i = 8; i < size - 8; i++) {
      var on = (i % 2 === 0) ? 1 : 0;
      m[6][i] = on; reserved[6][i] = 1;
      m[i][6] = on; reserved[i][6] = 1;
    }

    // Alignment squares, skipping the three corners the finders already own.
    var centres = ALIGNMENT[version];
    for (i = 0; i < centres.length; i++) {
      for (j = 0; j < centres.length; j++) {
        var cr = centres[i], cc = centres[j];
        if ((cr === 6 && cc === 6) ||
            (cr === 6 && cc === size - 7) ||
            (cr === size - 7 && cc === 6)) continue;
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            var ring = Math.max(Math.abs(dr), Math.abs(dc));
            m[cr + dr][cc + dc] = (ring === 1) ? 0 : 1;
            reserved[cr + dr][cc + dc] = 1;
          }
        }
      }
    }

    // Reserve — but don't yet fill — the format and version strips.
    for (i = 0; i <= 8; i++) {
      if (i !== 6) { reserved[8][i] = 1; reserved[i][8] = 1; }
    }
    for (i = 0; i < 8; i++) {
      reserved[8][size - 1 - i] = 1;
      reserved[size - 1 - i][8] = 1;
    }
    if (version >= 7) {
      for (i = 0; i < 6; i++) {
        for (j = 0; j < 3; j++) {
          reserved[i][size - 11 + j] = 1;
          reserved[size - 11 + j][i] = 1;
        }
      }
    }

    return { modules: m, reserved: reserved, size: size };
  }

  // Data snakes up and down the code two columns at a time, right to left,
  // stepping over the vertical timing line.
  function placeData(m, reserved, size, codewords) {
    var bit = 0;
    var total = codewords.length * 8;

    function next() {
      if (bit >= total) return 0; // leftover module positions stay light
      var v = (codewords[bit >> 3] >>> (7 - (bit & 7))) & 1;
      bit++;
      return v;
    }

    var upward = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (var k = 0; k < size; k++) {
        var row = upward ? size - 1 - k : k;
        for (var s = 0; s < 2; s++) {
          var c = col - s;
          if (!reserved[row][c]) m[row][c] = next();
        }
      }
      upward = !upward;
    }
  }

  function maskBit(id, r, c) {
    switch (id) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    }
  }

  function applyMask(m, reserved, size, id) {
    for (var r = 0; r < size; r++)
      for (var c = 0; c < size; c++)
        if (!reserved[r][c] && maskBit(id, r, c)) m[r][c] ^= 1;
  }

  // 15 bits: 5 bits of level+mask, a BCH remainder, then a fixed XOR so an
  // all-zero format string can't happen.
  function formatBits(mask) {
    var data = (0x0 << 3) | mask; // 0b00 is level M
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((data << 10) | (rem & 0x3ff)) ^ 0x5412;
  }

  // 18 bits, versions 7 and up only.
  function versionBits(version) {
    var rem = version;
    for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    return (version << 12) | (rem & 0xfff);
  }

  function writeFormat(m, size, mask) {
    var bits = formatBits(mask);
    var i;
    for (i = 0; i <= 5; i++) m[i][8] = (bits >>> i) & 1;
    m[7][8] = (bits >>> 6) & 1;
    m[8][8] = (bits >>> 7) & 1;
    m[8][7] = (bits >>> 8) & 1;
    for (i = 9; i < 15; i++) m[8][14 - i] = (bits >>> i) & 1;

    for (i = 0; i < 8; i++) m[8][size - 1 - i] = (bits >>> i) & 1;
    for (i = 8; i < 15; i++) m[size - 15 + i][8] = (bits >>> i) & 1;

    m[size - 8][8] = 1; // the module that is always dark
  }

  function writeVersion(m, size, version) {
    var bits = versionBits(version);
    for (var i = 0; i < 18; i++) {
      var bit = (bits >>> i) & 1;
      var a = size - 11 + (i % 3), b = Math.floor(i / 3);
      m[b][a] = bit;
      m[a][b] = bit;
    }
  }

  // ---------------------------------------------------------------------
  // Mask selection. All eight are tried and the least ugly wins — "ugly"
  // being the spec's four penalty rules, which between them punish the
  // shapes that confuse scanners.
  // ---------------------------------------------------------------------
  function runScore(run) { return run >= 5 ? 3 + (run - 5) : 0; }

  // Walks one row or column looking for the dark-light-dark-dark-dark-light-dark
  // core of a finder pattern. It only counts when there's a four-module light
  // run on one side; anything past the edge of the symbol is quiet zone, and
  // therefore light.
  var LOOKALIKE = [1, 0, 1, 1, 1, 0, 1];

  function scanLine(at, size) {
    var score = 0, i = 0;
    while (i <= size - 7) {
      var matched = true;
      for (var k = 0; k < 7; k++) {
        if (at(i + k) !== LOOKALIKE[k]) { matched = false; break; }
      }
      if (!matched) { i++; continue; }

      var clearBefore = true;
      for (var b = Math.max(i - 4, 0); b < i; b++) {
        if (at(b)) { clearBefore = false; break; }
      }
      var clearAfter = true;
      for (var a = i + 7; a < Math.min(i + 11, size); a++) {
        if (at(a)) { clearAfter = false; break; }
      }

      if (clearBefore || clearAfter) { score += 40; i += 7; }
      else { i += 4; } // the next possible match starts inside this one
    }
    return score;
  }

  function scanFinderLookalikes(m, size) {
    var score = 0, i;
    for (i = 0; i < size; i++) {
      score += scanLine((function (row) {
        return function (x) { return m[row][x]; };
      })(i), size);
      score += scanLine((function (col) {
        return function (x) { return m[x][col]; };
      })(i), size);
    }
    return score;
  }

  function penalty(m, size) {
    var score = 0, r, c, run;

    for (r = 0; r < size; r++) {
      run = 1;
      for (c = 1; c < size; c++) {
        if (m[r][c] === m[r][c - 1]) run++;
        else { score += runScore(run); run = 1; }
      }
      score += runScore(run);
    }
    for (c = 0; c < size; c++) {
      run = 1;
      for (r = 1; r < size; r++) {
        if (m[r][c] === m[r - 1][c]) run++;
        else { score += runScore(run); run = 1; }
      }
      score += runScore(run);
    }

    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        var v = m[r][c];
        if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
      }
    }

    // The 1:1:3:1:1 finder-lookalike, with a light area four modules wide on
    // one side or the other. Note that "light area" includes the quiet zone
    // surrounding the symbol, so a pattern flush against an edge counts —
    // missing that is what makes an encoder pick visibly worse masks.
    score += scanFinderLookalikes(m, size);

    var dark = 0;
    for (r = 0; r < size; r++)
      for (c = 0; c < size; c++) if (m[r][c]) dark++;
    var percent = dark * 100 / (size * size);
    score += Math.floor(Math.abs(percent - 50) / 5) * 10;

    return score;
  }

  function clone(m) {
    var out = [];
    for (var r = 0; r < m.length; r++) out.push(m[r].slice());
    return out;
  }

  // ---------------------------------------------------------------------
  // Public surface.
  // ---------------------------------------------------------------------

  /*
    encode(text) -> { version, size, mask, modules }

    `modules` is a size x size array of 0/1 rows, top-left origin, with no
    quiet zone. Throws if the text is longer than a version-10 code can hold.
  */
  function encode(text) {
    var bytes = toUtf8(String(text));
    var version = pickVersion(bytes.length);
    if (version < 0) {
      throw new Error("qr: " + bytes.length + " bytes is more than a version-" +
                      MAX_VERSION + " code can carry");
    }

    var codewords = interleave(dataCodewords(bytes, version), version);
    var base = buildFunctionPatterns(version);
    placeData(base.modules, base.reserved, base.size, codewords);

    // Try all eight masks and keep the least ugly. The format and version
    // strips are deliberately still blank at this point: ISO/IEC 18004 section
    // 7.8 scores the masked symbol *before* they go in, which also avoids the
    // circularity of scoring bits that encode the very mask being scored.
    var best = null;
    for (var mask = 0; mask < 8; mask++) {
      var candidate = clone(base.modules);
      applyMask(candidate, base.reserved, base.size, mask);
      var score = penalty(candidate, base.size);
      if (best === null || score < best.score) {
        best = { score: score, mask: mask, modules: candidate };
      }
    }

    writeFormat(best.modules, base.size, best.mask);
    if (version >= 7) writeVersion(best.modules, base.size, version);

    return {
      version: version,
      size: base.size,
      mask: best.mask,
      modules: best.modules
    };
  }

  /*
    toPath(code) -> an SVG path `d` covering every dark module, one unit per
    module. Pair it with viewBox="0 0 size size" and shape-rendering:
    crispEdges and it stays sharp at any size.
  */
  function toPath(code) {
    var parts = [];
    for (var r = 0; r < code.size; r++) {
      var c = 0;
      while (c < code.size) {
        if (!code.modules[r][c]) { c++; continue; }
        var start = c;
        while (c < code.size && code.modules[r][c]) c++;
        parts.push("M" + start + " " + r + "h" + (c - start) + "v1h-" + (c - start) + "z");
      }
    }
    return parts.join("");
  }

  return {
    encode: encode,
    toPath: toPath,
    MAX_VERSION: MAX_VERSION,
    // Exposed for the test suite, which checks the maths rather than trusting it.
    _internal: {
      TOTAL_CODEWORDS: TOTAL_CODEWORDS,
      EC_M: EC_M,
      toUtf8: toUtf8,
      pickVersion: pickVersion,
      dataCodewords: dataCodewords,
      dataCodewordCount: dataCodewordCount,
      interleave: interleave,
      generatorPoly: generatorPoly,
      ecCodewords: ecCodewords,
      formatBits: formatBits,
      versionBits: versionBits,
      charCountBits: charCountBits,
      penalty: penalty,
      maskBit: maskBit,
      applyMask: applyMask,
      writeFormat: writeFormat,
      writeVersion: writeVersion,
      buildFunctionPatterns: buildFunctionPatterns,
      ALIGNMENT: ALIGNMENT
    }
  };
});
