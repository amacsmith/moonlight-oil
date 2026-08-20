/*
  Tests for the hand-rolled QR encoder.

  A QR code that is subtly wrong still *looks* like a QR code, so "it renders"
  proves nothing. These tests check the parts that can actually be checked
  against something other than the encoder's own opinion:

    - the format and version bit strings, against the constants printed in
      ISO/IEC 18004 (the encoder derives them via BCH, so agreement is real
      evidence rather than a tautology)
    - Reed-Solomon: every codeword block must have zero syndromes, which is
      exactly what a decoder computes before it trusts a symbol
    - placement: reading the matrix back must reproduce the codewords
    - a golden matrix confirmed by an independent decoder

  The syndrome and placement checks are written independently of the encoder
  rather than by calling back into it, so a bug would have to appear in both
  to slip through.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const ROOT = resolve(import.meta.dirname, "..");
const MoonQR = require(resolve(ROOT, "stack/home/qr.js"));
const I = MoonQR._internal;

// ---------------------------------------------------------------------------
// An independent GF(256), used to check the encoder's error correction.
// ---------------------------------------------------------------------------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const gmul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/* Which modules are function patterns (and so carry no data)? Worked out
   here from the geometry rather than borrowed from the encoder. */
function functionModules(version) {
  const size = version * 4 + 17;
  const res = Array.from({ length: size }, () => new Array(size).fill(0));
  const finder = (row, col) => {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const rr = row + r, cc = col + c;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) res[rr][cc] = 1;
      }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) { res[6][i] = 1; res[i][6] = 1; }
  for (const cr of I.ALIGNMENT[version])
    for (const cc of I.ALIGNMENT[version]) {
      if ((cr === 6 && cc === 6) || (cr === 6 && cc === size - 7) || (cr === size - 7 && cc === 6)) continue;
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++) res[cr + dr][cc + dc] = 1;
    }
  for (let i = 0; i <= 8; i++) if (i !== 6) { res[8][i] = 1; res[i][8] = 1; }
  for (let i = 0; i < 8; i++) { res[8][size - 1 - i] = 1; res[size - 1 - i][8] = 1; }
  if (version >= 7)
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 3; j++) { res[i][size - 11 + j] = 1; res[size - 11 + j][i] = 1; }
  return res;
}

function maskAt(id, r, c) {
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

/* Undo the mask and walk the zigzag to recover the codeword stream — i.e. do
   what a decoder does. */
function readCodewords(code) {
  const { size, mask } = code;
  const res = functionModules(code.version);
  const m = code.modules.map((r) => r.slice());
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (!res[r][c] && maskAt(mask, r, c)) m[r][c] ^= 1;

  const bits = [];
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let k = 0; k < size; k++) {
      const row = upward ? size - 1 - k : k;
      for (let s = 0; s < 2; s++) {
        const c = col - s;
        if (!res[row][c]) bits.push(m[row][c]);
      }
    }
    upward = !upward;
  }
  const cw = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    cw.push(b);
  }
  return cw;
}

/* A valid Reed-Solomon codeword evaluates to zero at a^0..a^(n-1). */
function syndromesAreZero(codewords, version) {
  const [ecLen, g1, d1, g2, d2] = I.EC_M[version];
  const counts = [...Array(g1).fill(d1), ...Array(g2).fill(d2)];
  const blocks = counts.map(() => []);
  const eccs = counts.map(() => []);
  const totalData = counts.reduce((a, b) => a + b, 0);
  const longest = Math.max(...counts);

  let i = 0;
  for (let c = 0; c < longest; c++)
    for (let b = 0; b < counts.length; b++)
      if (c < counts[b]) blocks[b].push(codewords[i++]);
  i = totalData;
  for (let c = 0; c < ecLen; c++)
    for (let b = 0; b < counts.length; b++) eccs[b].push(codewords[i++]);

  return blocks.every((data, b) => {
    const full = [...data, ...eccs[b]];
    for (let s = 0; s < ecLen; s++) {
      let acc = 0;
      for (let j = 0; j < full.length; j++)
        acc ^= gmul(full[j], EXP[(s * (full.length - 1 - j)) % 255]);
      if (acc !== 0) return false;
    }
    return true;
  });
}

const SAMPLES = [
  "A",
  "http://192.168.1.42:8080",
  "http://10.0.0.7:8003",
  "Dad's Library",
  "http://DESKTOP-A1B2C3:8080",
  "café — naïve résumé",          // multi-byte UTF-8
  "x".repeat(60),
  "x".repeat(120),
  "x".repeat(213),                // exactly fills a version-10 symbol
];

describe("QR encoder — constants from the specification", () => {
  // ISO/IEC 18004 Table C.1, error-correction level M.
  const FORMAT_M = [
    "101010000010010", "101000100100101", "101111001111100", "101101101001011",
    "100010111111001", "100000011001110", "100111110010111", "100101010100000",
  ];

  FORMAT_M.forEach((expected, mask) => {
    it(`format bits for mask ${mask} match the spec`, () => {
      assert.equal(I.formatBits(mask).toString(2).padStart(15, "0"), expected);
    });
  });

  // ISO/IEC 18004 Table D.1 — version information, versions 7 and up.
  const VERSION_BITS = {
    7: "000111110010010100",
    8: "001000010110111100",
    9: "001001101010011001",
    10: "001010010011010011",
  };

  for (const [version, expected] of Object.entries(VERSION_BITS)) {
    it(`version bits for version ${version} match the spec`, () => {
      assert.equal(I.versionBits(Number(version)).toString(2).padStart(18, "0"), expected);
    });
  }

  it("total codeword counts match the spec", () => {
    assert.deepEqual(I.TOTAL_CODEWORDS, [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346]);
  });

  it("data plus error-correction codewords equal the symbol's capacity", () => {
    for (let v = 1; v <= MoonQR.MAX_VERSION; v++) {
      const [ecLen, g1, d1, g2, d2] = I.EC_M[v];
      const blocks = g1 + g2;
      const total = g1 * d1 + g2 * d2 + blocks * ecLen;
      assert.equal(total, I.TOTAL_CODEWORDS[v], `version ${v}`);
    }
  });
});

describe("QR encoder — structure", () => {
  for (const text of SAMPLES) {
    const label = text.length > 24 ? `${text.length} bytes` : JSON.stringify(text);

    it(`produces a well-formed symbol for ${label}`, () => {
      const code = MoonQR.encode(text);

      assert.equal(code.size, code.version * 4 + 17, "size follows 4V+17");
      assert.equal(code.modules.length, code.size);
      assert.ok(code.modules.every((r) => r.length === code.size), "matrix is square");
      assert.ok(code.mask >= 0 && code.mask <= 7, "mask is one of the eight");

      // Finder patterns: a dark 7x7 ring with a dark 3x3 core, in three corners.
      const m = code.modules;
      const n = code.size;
      for (const [r0, c0] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
        assert.equal(m[r0][c0], 1);
        assert.equal(m[r0 + 3][c0 + 3], 1, "finder core is dark");
        assert.equal(m[r0 + 1][c0 + 1], 0, "finder inner ring is light");
        assert.equal(m[r0 + 6][c0 + 6], 1);
      }

      // Timing patterns alternate, starting dark at index 8.
      for (let i = 8; i < n - 8; i++) {
        assert.equal(m[6][i], i % 2 === 0 ? 1 : 0, `horizontal timing at ${i}`);
        assert.equal(m[i][6], i % 2 === 0 ? 1 : 0, `vertical timing at ${i}`);
      }

      // The module that is always dark.
      assert.equal(m[n - 8][8], 1, "the fixed dark module");
    });
  }
});

describe("QR encoder — the maths a decoder checks", () => {
  for (const text of SAMPLES) {
    const label = text.length > 24 ? `${text.length} bytes` : JSON.stringify(text);

    it(`error correction is valid for ${label}`, () => {
      const code = MoonQR.encode(text);
      const recovered = readCodewords(code);
      assert.ok(
        syndromesAreZero(recovered, code.version),
        "every Reed-Solomon block should have zero syndromes",
      );
    });

    it(`data reads back out of the matrix for ${label}`, () => {
      const code = MoonQR.encode(text);
      const expected = I.interleave(I.dataCodewords(I.toUtf8(text), code.version), code.version);
      const recovered = readCodewords(code).slice(0, expected.length);
      assert.deepEqual(recovered, expected);
    });

    it(`the payload survives a round trip for ${label}`, () => {
      const code = MoonQR.encode(text);
      const cw = readCodewords(code);

      // De-interleave far enough to read the header and payload back.
      const [ecLen, g1, d1, g2, d2] = I.EC_M[code.version];
      const counts = [...Array(g1).fill(d1), ...Array(g2).fill(d2)];
      const blocks = counts.map(() => []);
      let i = 0;
      for (let c = 0; c < Math.max(...counts); c++)
        for (let b = 0; b < counts.length; b++)
          if (c < counts[b]) blocks[b].push(cw[i++]);
      const stream = blocks.flat();

      const bits = [];
      for (const byte of stream)
        for (let b = 7; b >= 0; b--) bits.push((byte >>> b) & 1);

      const take = (n) => bits.splice(0, n).reduce((acc, b) => (acc << 1) | b, 0);
      assert.equal(take(4), 0b0100, "byte mode indicator");
      const length = take(I.charCountBits(code.version));
      const bytes = [];
      for (let k = 0; k < length; k++) bytes.push(take(8));
      assert.equal(Buffer.from(bytes).toString("utf8"), text);
    });
  }
});

describe("QR encoder — capacity", () => {
  it("chooses the smallest version that fits", () => {
    assert.equal(MoonQR.encode("x".repeat(14)).version, 1);
    assert.equal(MoonQR.encode("x".repeat(15)).version, 2);
    assert.equal(MoonQR.encode("x".repeat(26)).version, 2);
    assert.equal(MoonQR.encode("x".repeat(27)).version, 3);
  });

  it("switches to a 16-bit length field at version 10", () => {
    assert.equal(I.charCountBits(9), 8);
    assert.equal(I.charCountBits(10), 16);
  });

  it("fills a version-10 symbol exactly at 213 bytes", () => {
    assert.equal(MoonQR.encode("x".repeat(213)).version, 10);
  });

  it("refuses anything larger than it can encode", () => {
    assert.throws(() => MoonQR.encode("x".repeat(214)), /more than a version-10 code/);
  });

  it("counts UTF-8 bytes, not characters", () => {
    // Each of these is one character but three bytes.
    assert.equal(I.toUtf8("—").length, 3);
    assert.ok(MoonQR.encode("—".repeat(70)).version >= 6);
  });
});

describe("QR encoder — a golden symbol", () => {
  /* Produced by this encoder and confirmed by decoding the rendered image with
     an independent decoder (OpenCV). If a refactor changes any module here,
     the output has changed and needs re-verifying against a real scanner. */
  const GOLDEN = [
    "1111111000010100101111111",
    "1000001010111010001000001",
    "1011101010111000101011101",
    "1011101010001111101011101",
    "1011101001111010001011101",
    "1000001000000100101000001",
    "1111111010101010101111111",
    "0000000011001000000000000",
    "1000001010000101111001110",
    "1111110111011101110011110",
    "1110011011110101001101011",
    "1111000101110001100011001",
    "1101011111000010111000001",
    "1100000001001111000000010",
    "1011001111000001010101011",
    "1010010010101010100010101",
    "1001011011101100111110100",
    "0000000010100011100010100",
    "1111111000001110101011001",
    "1000001001010000100010001",
    "1011101001111101111111100",
    "1011101001001100001101011",
    "1011101001001000010000101",
    "1000001001001001101110001",
    "1111111010110011101001001",
  ];

  it("encodes a typical LAN address to the expected matrix", () => {
    const code = MoonQR.encode("http://192.168.1.42:8080");
    assert.equal(code.version, 2);
    assert.equal(code.mask, 5);
    assert.deepEqual(code.modules.map((r) => r.join("")), GOLDEN);
  });
});

describe("QR encoder — SVG output", () => {
  it("covers exactly the dark modules", () => {
    const code = MoonQR.encode("http://192.168.1.42:8080");
    const path = MoonQR.toPath(code);

    // Each run becomes "M<x> <y>h<len>v1h-<len>z"; the lengths must add up to
    // the number of dark modules.
    const runs = [...path.matchAll(/h(\d+)v1/g)].map((m) => Number(m[1]));
    const drawn = runs.reduce((a, b) => a + b, 0);
    const dark = code.modules.flat().filter(Boolean).length;
    assert.equal(drawn, dark);
  });

  it("emits nothing but path commands", () => {
    const path = MoonQR.toPath(MoonQR.encode("A"));
    assert.match(path, /^[Mmhvzs0-9 .,-]+$/, "no stray characters that could break the SVG");
  });
});
