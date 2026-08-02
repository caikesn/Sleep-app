/**
 * 8-bit RGBA PNG encoding, hand-rolled on Node's built-in zlib.
 *
 * Same reasoning as `wav.mjs`: an icon pipeline that needs sharp or canvas
 * pulls a native binary into a project that currently has three dev
 * dependencies. PNG is a short enough format to write out — a header, one
 * deflated block of scanlines, an end marker — and doing it here means the
 * committed icons are exactly what the generator produced, with no encoder in
 * between that anyone has to reproduce later.
 */

import { deflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length, 0);

  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);

  return Buffer.concat([head, body, crc]);
}

/**
 * The Paeth filter, PNG's own predictor.
 *
 * Filter 0 (store the bytes as they are) would work and be three lines shorter,
 * but every image this generator makes is a wide smooth gradient — exactly the
 * case where deflate on raw bytes does badly and on per-pixel deltas does well.
 * It is the difference between an icon that weighs 700 KB and one that weighs
 * 40 KB, for one pass over the buffer.
 */
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * `rgba` is width * height * 4 bytes, row-major, non-premultiplied.
 */
export function encodePng(rgba, width, height) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 4; // Paeth

    for (let x = 0; x < stride; x += 1) {
      const value = rgba[y * stride + x];
      const left = x >= 4 ? rgba[y * stride + x - 4] : 0;
      const up = y > 0 ? rgba[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= 4 ? rgba[(y - 1) * stride + x - 4] : 0;
      raw[rowStart + 1 + x] = (value - paeth(left, up, upLeft)) & 0xff;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * A blank RGBA buffer. Fully transparent, so anything undrawn stays that way.
 *
 * Float, not Uint8: the bloom in the icon is a gradient that crosses one 8-bit
 * step every forty pixels or so, and rounding each blend as it happens lays
 * down visible concentric rings. Keeping the buffer continuous and quantising
 * once, at the end, is what `toBytes` is for.
 */
export function canvas(size) {
  return new Float32Array(size * size * 4);
}

// Ordered 8x8 Bayer. Deterministic on purpose — random dither would hide the
// banding just as well but produce a different file on every run, and these
// PNGs are committed.
const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

/**
 * Quantises the float canvas to bytes, dithering by less than one level.
 *
 * A gradient this shallow has no dither-free representation at 8 bits: the
 * choice is between rings and a sub-pixel amount of noise, and the noise is
 * invisible at any size these icons are seen at.
 */
export function toBytes(px, size) {
  const out = new Uint8ClampedArray(px.length);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const noise = BAYER[y & 7][x & 7] / 64 - 0.5;
      const i = (y * size + x) * 4;
      for (let c = 0; c < 4; c += 1) out[i + c] = px[i + c] + noise;
    }
  }

  return out;
}

/** `#rrggbb` to a [r, g, b] triple, so the theme's own hex values can be pasted in. */
export function hex(value) {
  const n = parseInt(value.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function mix(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/**
 * Source-over blend of one pixel.
 *
 * Straight (non-premultiplied) alpha, because that is what the PNG will hold
 * and what every consumer of these files expects.
 */
export function blend(px, index, rgb, alpha) {
  if (alpha <= 0) return;

  const i = index * 4;
  const dstA = px[i + 3] / 255;
  const outA = alpha + dstA * (1 - alpha);
  if (outA <= 0) return;

  for (let c = 0; c < 3; c += 1) {
    px[i + c] = (rgb[c] * alpha + px[i + c] * dstA * (1 - alpha)) / outA;
  }
  px[i + 3] = outA * 255;
}

/** Adds light without darkening what is under it — for glows and blooms. */
export function addLight(px, index, rgb, amount) {
  if (amount <= 0) return;

  const i = index * 4;
  for (let c = 0; c < 3; c += 1) px[i + c] += rgb[c] * amount;
  px[i + 3] = Math.max(px[i + 3], Math.min(255, amount * 255));
}

export function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
