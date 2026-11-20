import type { RGB } from '../types';

export function clamp255(v: number): number {
  return v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v);
}

export function clamp01(v: number): number {
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

export function hexToRgb(hex: string): RGB {
  const clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0;
    const g = parseInt(clean[1] + clean[1], 16) || 0;
    const b = parseInt(clean[2] + clean[2], 16) || 0;
    return [r, g, b];
  }
  const num = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const rr = clamp255(r).toString(16).padStart(2, '0');
  const gg = clamp255(g).toString(16).padStart(2, '0');
  const bb = clamp255(b).toString(16).padStart(2, '0');
  return `#${rr}${gg}${bb}`;
}

// Precomputed sRGB [0..255] -> Linear [0..1] LUT
const SRGB_TO_LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// Precomputed CIE Lab f(t) LUT for t in [0..1.1] (4096 bins)
const LAB_LUT_SIZE = 4096;
const LAB_LUT_MAX = 1.1;
const LAB_F_LUT = new Float32Array(LAB_LUT_SIZE + 1);
const LAB_EPS = 216 / 24389; // 0.00885645...
const LAB_K = 24389 / 27; // 903.296296...

for (let i = 0; i <= LAB_LUT_SIZE; i++) {
  const t = (i / LAB_LUT_SIZE) * LAB_LUT_MAX;
  LAB_F_LUT[i] = t > LAB_EPS ? Math.cbrt(t) : (LAB_K * t + 16) / 116;
}

function labF(t: number): number {
  if (t <= 0) return 16 / 116;
  if (t < LAB_LUT_MAX) {
    return LAB_F_LUT[(t * (LAB_LUT_SIZE / LAB_LUT_MAX) + 0.5) | 0];
  }
  return Math.cbrt(t);
}

// D65 reference white
const D65_X = 0.95047;
const D65_Y = 1.0;
const D65_Z = 1.08883;

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lr = SRGB_TO_LIN[r <= 0 ? 0 : r >= 255 ? 255 : r | 0];
  const lg = SRGB_TO_LIN[g <= 0 ? 0 : g >= 255 ? 255 : g | 0];
  const lb = SRGB_TO_LIN[b <= 0 ? 0 : b >= 255 ? 255 : b | 0];

  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / D65_X;
  const y = (0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb) / D65_Y;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / D65_Z;

  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToRgb(L: number, a: number, b: number): RGB {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const fx3 = fx * fx * fx;
  const fy3 = fy * fy * fy;
  const fz3 = fz * fz * fz;

  const xr = fx3 > LAB_EPS ? fx3 : (116 * fx - 16) / LAB_K;
  const yr = L > LAB_K * LAB_EPS ? fy3 : L / LAB_K;
  const zr = fz3 > LAB_EPS ? fz3 : (116 * fz - 16) / LAB_K;

  const X = xr * D65_X;
  const Y = yr * D65_Y;
  const Z = zr * D65_Z;

  const lr = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
  const lg = -0.969266 * X + 1.8760108 * Y + 0.041556 * Z;
  const lb = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;

  const linToSrgb = (c: number) => {
    const clamped = c <= 0 ? 0 : c >= 1 ? 1 : c;
    const s = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    return clamp255(s * 255);
  };

  return [linToSrgb(lr), linToSrgb(lg), linToSrgb(lb)];
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) * 0.5;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }
  return [h * 60, s, l];
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  const hn = ((h % 360) + 360) % 360;
  const sn = clamp01(s);
  const ln = clamp01(l);

  if (sn === 0) {
    const v = clamp255(ln * 255);
    return [v, v, v];
  }

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c * 0.5;

  let r = 0;
  let g = 0;
  let b = 0;
  if (hn < 60) [r, g, b] = [c, x, 0];
  else if (hn < 120) [r, g, b] = [x, c, 0];
  else if (hn < 180) [r, g, b] = [0, c, x];
  else if (hn < 240) [r, g, b] = [0, x, c];
  else if (hn < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return [clamp255((r + m) * 255), clamp255((g + m) * 255), clamp255((b + m) * 255)];
}

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, v];
}

export function hsvToRgb(h: number, s: number, v: number): RGB {
  const hn = ((h % 360) + 360) % 360;
  const sn = clamp01(s);
  const vn = clamp01(v);
  const c = vn * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = vn - c;

  let r = 0;
  let g = 0;
  let b = 0;
  if (hn < 60) [r, g, b] = [c, x, 0];
  else if (hn < 120) [r, g, b] = [x, c, 0];
  else if (hn < 180) [r, g, b] = [0, c, x];
  else if (hn < 240) [r, g, b] = [0, x, c];
  else if (hn < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return [clamp255((r + m) * 255), clamp255((g + m) * 255), clamp255((b + m) * 255)];
}

export function rgbToYcbcr(r: number, g: number, b: number): [number, number, number] {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return [y, cb, cr];
}

export function ycbcrToRgb(y: number, cb: number, cr: number): [number, number, number] {
  const r = y + 1.402 * (cr - 128);
  const g = y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128);
  const b = y + 1.772 * (cb - 128);
  return [r, g, b];
}

export function luminance709(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
