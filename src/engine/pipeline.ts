import type {
  DesaturateMode,
  NamedPalette,
  OverlayBlendMode,
  PalettizeColorSpace,
  PalettizeParams,
  PipelineStageId,
  RGB,
  ZatoConfig,
} from '../types';
import {
  clamp01,
  clamp255,
  hexToRgb,
  hslToRgb,
  hsvToRgb,
  labToRgb,
  luminance709,
  rgbToHsl,
  rgbToHsv,
  rgbToLab,
  rgbToYcbcr,
  ycbcrToRgb,
} from './colorSpace';
import { buildCurveLut } from './curves';
import { buildGradientLut, sampleGradientShape } from './gradients';
import { BUILTIN_BASE_PALETTES, BUILTIN_COLOR_PALETTES } from './palettes';
import {
  BAYER_4X4,
  BAYER_8X8,
  createGaussianRng,
  createMulberry32,
  hashPixelChannel,
} from './prng';

export interface PixelBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface PipelineResult {
  buffer: PixelBuffer;
  histogram: Uint32Array; // 256 luminance bins measured right before Tone Curves
  durationMs: number;
}

interface CompiledPalette {
  count: number;
  rgb: Uint8Array;
  lab: Float32Array;
  cacheKeys: Int32Array;
  cacheVals: Uint16Array;
}

const compiledPaletteCache = new Map<string, CompiledPalette>();

function compilePalette(hexColors: string[]): CompiledPalette {
  const safe = hexColors.length > 0 ? hexColors : ['#000000', '#ffffff'];
  const key = safe.join(',');
  const hit = compiledPaletteCache.get(key);
  if (hit) return hit;

  const count = safe.length;
  const rgb = new Uint8Array(count * 3);
  const lab = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const [r, g, b] = hexToRgb(safe[i]);
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
    const [L, a, bb] = rgbToLab(r, g, b);
    lab[i * 3] = L;
    lab[i * 3 + 1] = a;
    lab[i * 3 + 2] = bb;
  }
  const cacheKeys = new Int32Array(65536);
  cacheKeys.fill(-1);
  const cacheVals = new Uint16Array(65536);
  const compiled: CompiledPalette = { count, rgb, lab, cacheKeys, cacheVals };

  if (compiledPaletteCache.size > 24) {
    const firstKey = compiledPaletteCache.keys().next().value;
    if (firstKey !== undefined) compiledPaletteCache.delete(firstKey);
  }
  compiledPaletteCache.set(key, compiled);
  return compiled;
}

function findNearestPaletteIndex(
  pal: CompiledPalette,
  r: number,
  g: number,
  b: number,
  colorSpace: PalettizeColorSpace,
): number {
  const key = (colorSpace === 'lab' ? 0x1000000 : 0) | (r << 16) | (g << 8) | b;
  const slot = (Math.imul(key, 2654435761) >>> 16) & 0xffff;
  if (pal.cacheKeys[slot] === key) {
    return pal.cacheVals[slot];
  }

  let bestIdx = 0;
  let bestDist = Infinity;
  const count = pal.count;

  if (colorSpace === 'lab') {
    const [L, a, bb] = rgbToLab(r, g, b);
    const pLab = pal.lab;
    for (let i = 0; i < count; i++) {
      const o = i * 3;
      const dL = L - pLab[o];
      const da = a - pLab[o + 1];
      const db = bb - pLab[o + 2];
      const dist = dL * dL + da * da + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
  } else {
    const pRgb = pal.rgb;
    for (let i = 0; i < count; i++) {
      const o = i * 3;
      const dr = r - pRgb[o];
      const dg = g - pRgb[o + 1];
      const db = b - pRgb[o + 2];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
  }

  pal.cacheKeys[slot] = key;
  pal.cacheVals[slot] = bestIdx;
  return bestIdx;
}

export function applyDesaturate(data: Uint8ClampedArray, mode: DesaturateMode): void {
  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let v: number;
    switch (mode) {
      case 'lightness':
        v = ((Math.max(r, g, b) + Math.min(r, g, b)) * 0.5 + 0.5) | 0;
        break;
      case 'bt709':
        v = (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.5) | 0;
        break;
      case 'bt601':
        v = (0.299 * r + 0.587 * g + 0.114 * b + 0.5) | 0;
        break;
      case 'average':
        v = ((r + g + b) / 3 + 0.5) | 0;
        break;
      case 'min':
        v = Math.min(r, g, b);
        break;
      case 'max':
        v = Math.max(r, g, b);
        break;
    }
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
}

export function applyPalettize(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: Omit<PalettizeParams, 'enabled'>,
  paletteHexColors: string[],
): void {
  const pal = compilePalette(paletteHexColors);
  const pRgb = pal.rgb;
  const doDither = params.dither && params.offsetScale > 0 && params.spread > 0;
  // Krita Per-Channel Offset amplitude: (threshold - 0.5) * spread * offsetScale * 255
  // Note: full peak-to-peak swing equals offsetScale * spread * 255 (at 0.125 -> ±16 levels)
  const scale255 = params.spread * params.offsetScale * 255;
  const seed = params.seed | 0;
  const thresholdMode = params.thresholdMode;
  const perChannel = params.colorMode === 'per_channel';
  const colorSpace = params.colorSpace;

  // Fast tonal-ramp mode: maps pixel luminance (with optional Noise/Bayer dither)
  // directly across palette swatches 0..(N-1) so every edited/vivid swatch is guaranteed visible
  if (colorSpace === 'luminance') {
    const maxIdx = Math.max(0, pal.count - 1);
    const inv255 = maxIdx / 255;
    let idx = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let lum = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
        if (doDither) {
          if (thresholdMode === 'noise') {
            lum += (hashPixelChannel(x, y, 0, seed) - 0.5) * scale255;
          } else if (thresholdMode === 'bayer4') {
            lum += (BAYER_4X4[((y & 3) << 2) | (x & 3)] - 0.5) * scale255;
          } else {
            lum += (BAYER_8X8[((y & 7) << 3) | (x & 7)] - 0.5) * scale255;
          }
          if (lum < 0) lum = 0;
          else if (lum > 255) lum = 255;
        }
        const palIdx = Math.round(lum * inv255) * 3;
        data[idx] = pRgb[palIdx];
        data[idx + 1] = pRgb[palIdx + 1];
        data[idx + 2] = pRgb[palIdx + 2];
        idx += 4;
      }
    }
    return;
  }

  let idx = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = data[idx];
      let g = data[idx + 1];
      let b = data[idx + 2];

      if (doDither) {
        if (thresholdMode === 'noise') {
          if (perChannel) {
            const nr = (hashPixelChannel(x, y, 0, seed) - 0.5) * scale255;
            const ng = (hashPixelChannel(x, y, 1, seed) - 0.5) * scale255;
            const nb = (hashPixelChannel(x, y, 2, seed) - 0.5) * scale255;
            r = clamp255(r + nr);
            g = clamp255(g + ng);
            b = clamp255(b + nb);
          } else {
            const n = (hashPixelChannel(x, y, 0, seed) - 0.5) * scale255;
            r = clamp255(r + n);
            g = clamp255(g + n);
            b = clamp255(b + n);
          }
        } else if (thresholdMode === 'bayer4') {
          const t = (BAYER_4X4[((y & 3) << 2) | (x & 3)] - 0.5) * scale255;
          r = clamp255(r + t);
          g = clamp255(g + t);
          b = clamp255(b + t);
        } else {
          const t = (BAYER_8X8[((y & 7) << 3) | (x & 7)] - 0.5) * scale255;
          r = clamp255(r + t);
          g = clamp255(g + t);
          b = clamp255(b + t);
        }
      }

      const best = findNearestPaletteIndex(pal, r, g, b, colorSpace) * 3;
      data[idx] = pRgb[best];
      data[idx + 1] = pRgb[best + 1];
      data[idx + 2] = pRgb[best + 2];
      idx += 4;
    }
  }
}

function blendChannel(base: number, grad: number, mode: OverlayBlendMode): number {
  switch (mode) {
    case 'grainMerge':
      // Exact Krita KoCompositeOpGrainMerge: clamp(base + blend - 128, 0, 255)
      return clamp255(base + grad - 128);
    case 'multiply':
      return Math.round((base * grad) / 255);
    case 'overlay':
      return base < 128
        ? Math.round((2 * base * grad) / 255)
        : Math.round(255 - (2 * (255 - base) * (255 - grad)) / 255);
    case 'hardLight':
      return grad < 128
        ? Math.round((2 * base * grad) / 255)
        : Math.round(255 - (2 * (255 - base) * (255 - grad)) / 255);
    case 'softLight': {
      const b = base / 255;
      const g = grad / 255;
      let res: number;
      if (g <= 0.5) {
        res = b - (1 - 2 * g) * b * (1 - b);
      } else {
        const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
        res = b + (2 * g - 1) * (d - b);
      }
      return clamp255(res * 255);
    }
    case 'color':
      return base; // Handled at pixel level
  }
}

// Precomputed 16384-sample exact Box-Muller standard normal table for fast Gaussian noise
const GAUSS_TABLE_SIZE = 16384;
const GAUSS_TABLE_MASK = GAUSS_TABLE_SIZE - 1;
const GAUSS_TABLE = new Float32Array(GAUSS_TABLE_SIZE);
{
  const initGauss = createGaussianRng(0x5a70beef);
  for (let i = 0; i < GAUSS_TABLE_SIZE; i++) {
    GAUSS_TABLE[i] = initGauss();
  }
}

function applyAdditiveNoise(
  data: Uint8ClampedArray,
  cfg: ZatoConfig['noise'],
): void {
  if (!cfg.enabled || cfg.amplitude <= 0) return;
  const amp = cfg.amplitude;
  const len = data.length;
  const pixelCount = len >> 2;
  let rngState = ((cfg.seed | 0) + 0x6d2b79f5) | 0;
  const nextU32 = (): number => {
    rngState = (rngState + 0x6d2b79f5) | 0;
    let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
  const rand = createMulberry32(cfg.seed ^ 0x9e3779b9);

  // Fast path: most common G'MIC default (Gaussian + RGBA [All] + Cut)
  if (cfg.type === 'gaussian' && cfg.channel === 'rgba_all' && cfg.valueAction === 'cut') {
    for (let i = 0; i < len; i += 4) {
      const dr = GAUSS_TABLE[nextU32() & GAUSS_TABLE_MASK] * amp;
      const dg = GAUSS_TABLE[nextU32() & GAUSS_TABLE_MASK] * amp;
      const db = GAUSS_TABLE[nextU32() & GAUSS_TABLE_MASK] * amp;
      data[i] = clamp255(data[i] + dr);
      data[i + 1] = clamp255(data[i + 1] + dg);
      data[i + 2] = clamp255(data[i + 2] + db);
    }
    return;
  }

  const sampleDelta = (): number => {
    if (cfg.type === 'gaussian') {
      return GAUSS_TABLE[nextU32() & GAUSS_TABLE_MASK] * amp;
    }
    if (cfg.type === 'uniform') {
      return (rand() * 2 - 1) * amp * 1.7320508;
    }
    // Salt & Pepper
    const prob = Math.min(0.6, amp / 140);
    const u = rand();
    if (u < prob * 0.5) return -255;
    if (u < prob) return 255;
    return 0;
  };

  const applyAction = (v: number): number => {
    if (cfg.valueAction === 'loop') {
      const m = ((Math.round(v) % 256) + 256) % 256;
      return m;
    }
    return clamp255(v);
  };

  // For 'normalize' mode, accumulate float channels first then rescale to [0..255]
  const useNormalize = cfg.valueAction === 'normalize';
  const floatBuf = useNormalize ? new Float32Array(pixelCount * 3) : null;
  let minV = Infinity;
  let maxV = -Infinity;

  const writePixel = (pIdx: number, nr: number, ng: number, nb: number) => {
    if (floatBuf) {
      const f = pIdx * 3;
      floatBuf[f] = nr;
      floatBuf[f + 1] = ng;
      floatBuf[f + 2] = nb;
      if (nr < minV) minV = nr;
      if (ng < minV) minV = ng;
      if (nb < minV) minV = nb;
      if (nr > maxV) maxV = nr;
      if (ng > maxV) maxV = ng;
      if (nb > maxV) maxV = nb;
    } else {
      const i = pIdx << 2;
      data[i] = applyAction(nr);
      data[i + 1] = applyAction(ng);
      data[i + 2] = applyAction(nb);
    }
  };

  for (let p = 0; p < pixelCount; p++) {
    const i = p << 2;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    switch (cfg.channel) {
      case 'rgba_all': {
        writePixel(p, r + sampleDelta(), g + sampleDelta(), b + sampleDelta());
        break;
      }
      case 'rgb_red': {
        writePixel(p, r + sampleDelta(), g, b);
        break;
      }
      case 'rgb_green': {
        writePixel(p, r, g + sampleDelta(), b);
        break;
      }
      case 'rgb_blue': {
        writePixel(p, r, g, b + sampleDelta());
        break;
      }
      case 'ycbcr_y': {
        const [y, cb, cr] = rgbToYcbcr(r, g, b);
        const [nr, ng, nb] = ycbcrToRgb(y + sampleDelta(), cb, cr);
        writePixel(p, nr, ng, nb);
        break;
      }
      case 'ycbcr_cbcr': {
        const [y, cb, cr] = rgbToYcbcr(r, g, b);
        const [nr, ng, nb] = ycbcrToRgb(y, cb + sampleDelta(), cr + sampleDelta());
        writePixel(p, nr, ng, nb);
        break;
      }
      case 'lab_l': {
        const [L, a, bb] = rgbToLab(r, g, b);
        const [nr, ng, nb] = labToRgb(L + sampleDelta() * (100 / 255), a, bb);
        writePixel(p, nr, ng, nb);
        break;
      }
      case 'lab_ab': {
        const [L, a, bb] = rgbToLab(r, g, b);
        const [nr, ng, nb] = labToRgb(L, a + sampleDelta(), bb + sampleDelta());
        writePixel(p, nr, ng, nb);
        break;
      }
      case 'hsv_h': {
        const [h, s, v] = rgbToHsv(r, g, b);
        const [nr, ng, nb] = hsvToRgb(h + sampleDelta() * 1.4, s, v);
        writePixel(p, nr, ng, nb);
        break;
      }
      case 'hsv_s': {
        const [h, s, v] = rgbToHsv(r, g, b);
        const [nr, ng, nb] = hsvToRgb(h, clamp01(s + sampleDelta() / 255), v);
        writePixel(p, nr, ng, nb);
        break;
      }
      case 'hsv_v': {
        const [h, s, v] = rgbToHsv(r, g, b);
        const [nr, ng, nb] = hsvToRgb(h, s, clamp01(v + sampleDelta() / 255));
        writePixel(p, nr, ng, nb);
        break;
      }
    }
  }

  if (floatBuf) {
    const span = maxV - minV;
    const inv = span > 1e-6 ? 255 / span : 1;
    for (let p = 0; p < pixelCount; p++) {
      const f = p * 3;
      const i = p << 2;
      data[i] = clamp255((floatBuf[f] - minV) * inv);
      data[i + 1] = clamp255((floatBuf[f + 1] - minV) * inv);
      data[i + 2] = clamp255((floatBuf[f + 2] - minV) * inv);
    }
  }
}

export function applyPosterize(data: Uint8ClampedArray, levels: number): void {
  const clampedLevels = Math.max(2, Math.min(64, Math.round(levels)));
  const lut = new Uint8Array(256);
  const denom = clampedLevels - 1;
  for (let i = 0; i < 256; i++) {
    lut[i] = clamp255((Math.round((i / 255) * denom) / denom) * 255);
  }
  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }
}

function computeHistogram(data: Uint8ClampedArray): Uint32Array {
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] + 0.5) | 0;
    hist[lum <= 0 ? 0 : lum >= 255 ? 255 : lum]++;
  }
  return hist;
}

function resolvePaletteColors(
  paletteId: string,
  palettes: NamedPalette[],
  fallbackList: NamedPalette[],
): string[] {
  const found = palettes.find((p) => p.id === paletteId) ?? fallbackList.find((p) => p.id === paletteId);
  return found ? found.colors : fallbackList[0].colors;
}

interface BaseStageCacheEntry {
  sourceRef: Uint8ClampedArray;
  width: number;
  height: number;
  signature: string;
  data: Uint8ClampedArray;
  luminance: Uint8Array;
}

let baseStageCache: BaseStageCacheEntry | null = null;

/**
 * Executes the complete ZATO Background Generator pipeline (zaterr.pdf Pages 1–12).
 * Pure function operating directly on RGBA pixel buffers — zero DOM dependencies.
 */
export function runZatoPipeline(
  source: PixelBuffer,
  config: ZatoConfig,
  allPalettes: NamedPalette[],
  targetStage: PipelineStageId = 'final',
): PipelineResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const { width, height } = source;
  let histogram: Uint32Array = new Uint32Array(256);

  const finish = (buf: Uint8ClampedArray): PipelineResult => {
    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return {
      buffer: { width, height, data: buf },
      histogram,
      durationMs: Math.max(0, t1 - t0),
    };
  };

  if (targetStage === 'original') {
    const work = new Uint8ClampedArray(source.data);
    histogram = computeHistogram(work);
    return finish(work);
  }

  if (targetStage === 'desaturate') {
    const work = new Uint8ClampedArray(source.data);
    if (config.desaturate.enabled) {
      applyDesaturate(work, config.desaturate.mode);
    }
    histogram = computeHistogram(work);
    return finish(work);
  }

  // Stage 1 + Stage 2 cached so dragging Threshold / Colour / Curves / Noise / Posterize runs at ~10ms
  const baseColors = resolvePaletteColors(
    config.basePalettize.paletteId,
    allPalettes,
    BUILTIN_BASE_PALETTES,
  );
  const baseSig = JSON.stringify([
    config.desaturate,
    config.basePalettize,
    config.basePalettize.enabled ? baseColors : null,
  ]);

  let cachedBase = baseStageCache;
  if (
    !cachedBase ||
    cachedBase.sourceRef !== source.data ||
    cachedBase.width !== width ||
    cachedBase.height !== height ||
    cachedBase.signature !== baseSig
  ) {
    const baseData = new Uint8ClampedArray(source.data);
    if (config.desaturate.enabled) {
      applyDesaturate(baseData, config.desaturate.mode);
    }
    if (config.basePalettize.enabled) {
      applyPalettize(baseData, width, height, config.basePalettize, baseColors);
    }
    const baseLum = new Uint8Array(width * height);
    for (let p = 0, i = 0; i < baseData.length; p++, i += 4) {
      baseLum[p] = clamp255(luminance709(baseData[i], baseData[i + 1], baseData[i + 2]));
    }
    cachedBase = {
      sourceRef: source.data,
      width,
      height,
      signature: baseSig,
      data: baseData,
      luminance: baseLum,
    };
    baseStageCache = cachedBase;
  }

  const work = new Uint8ClampedArray(cachedBase.data);
  if (targetStage === 'palettize') {
    histogram = computeHistogram(work);
    return finish(work);
  }

  // Stage 3 & 4: Solid Black (Darken) & Solid White (Lighten) Thresholds (Pages 3 & 4)
  // Remember Page 4: White threshold duplicates the *palettized base layer*, not the blackened layer!
  const baseLuminance = cachedBase.luminance;

  const blackRgb: RGB = hexToRgb(config.thresholds.blackColor);
  const whiteRgb: RGB = hexToRgb(config.thresholds.whiteColor);
  const blackThresh = config.thresholds.blackThreshold;
  const whiteThresh = config.thresholds.whiteThreshold;
  const hasCustomBlackTint = config.thresholds.blackColor.toLowerCase() !== '#000000';
  const hasCustomWhiteTint = config.thresholds.whiteColor.toLowerCase() !== '#ffffff';

  if (targetStage === 'blackMask') {
    for (let p = 0, i = 0; i < work.length; p++, i += 4) {
      const isBlack = baseLuminance[p] <= blackThresh;
      work[i] = isBlack ? blackRgb[0] : 255;
      work[i + 1] = isBlack ? blackRgb[1] : 255;
      work[i + 2] = isBlack ? blackRgb[2] : 255;
    }
    histogram = computeHistogram(work);
    return finish(work);
  }

  if (config.thresholds.blackEnabled && config.thresholds.blackOpacity > 0) {
    const op = clamp01(config.thresholds.blackOpacity);
    const invOp = 1 - op;
    for (let p = 0, i = 0; i < work.length; p++, i += 4) {
      if (baseLuminance[p] <= blackThresh) {
        work[i] = clamp255(work[i] * invOp + blackRgb[0] * op);
        work[i + 1] = clamp255(work[i + 1] * invOp + blackRgb[1] * op);
        work[i + 2] = clamp255(work[i + 2] * invOp + blackRgb[2] * op);
      }
    }
  }
  if (targetStage === 'blackDarken') {
    histogram = computeHistogram(work);
    return finish(work);
  }

  if (targetStage === 'whiteMask') {
    for (let p = 0, i = 0; i < work.length; p++, i += 4) {
      const isWhite = baseLuminance[p] >= whiteThresh;
      work[i] = isWhite ? whiteRgb[0] : 0;
      work[i + 1] = isWhite ? whiteRgb[1] : 0;
      work[i + 2] = isWhite ? whiteRgb[2] : 0;
    }
    histogram = computeHistogram(work);
    return finish(work);
  }

  if (config.thresholds.whiteEnabled && config.thresholds.whiteOpacity > 0) {
    const op = clamp01(config.thresholds.whiteOpacity);
    const invOp = 1 - op;
    for (let p = 0, i = 0; i < work.length; p++, i += 4) {
      if (baseLuminance[p] >= whiteThresh) {
        work[i] = clamp255(work[i] * invOp + whiteRgb[0] * op);
        work[i + 1] = clamp255(work[i + 1] * invOp + whiteRgb[1] * op);
        work[i + 2] = clamp255(work[i + 2] * invOp + whiteRgb[2] * op);
      }
    }
  }
  if (targetStage === 'whiteLighten') {
    histogram = computeHistogram(work);
    return finish(work);
  }

  // Stage 5: Colouring (Pages 5, 6, 8, 9, 10, 11, 12)
  const col = config.colouring;
  if (col.mode === 'colourized') {
    const hue = col.hue;
    const sat = clamp01(col.saturation / 100);
    const lShift = col.lightness / 100;
    // Exact 511-entry LUT over (max(r,g,b) + min(r,g,b)) in 0..510
    const colorizeLut = new Uint8Array(511 * 3);
    for (let k = 0; k <= 510; k++) {
      const baseL = k / 510;
      const adjustedL = lShift === 0 ? baseL : clamp01(baseL + lShift);
      const [nr, ng, nb] = hslToRgb(hue, sat, adjustedL);
      const o = k * 3;
      colorizeLut[o] = nr;
      colorizeLut[o + 1] = ng;
      colorizeLut[o + 2] = nb;
    }
    for (let i = 0; i < work.length; i += 4) {
      const r = work[i];
      const g = work[i + 1];
      const b = work[i + 2];
      const max = r >= g ? (r >= b ? r : b) : (g >= b ? g : b);
      const min = r <= g ? (r <= b ? r : b) : (g <= b ? g : b);
      const o = (max + min) * 3;
      work[i] = colorizeLut[o];
      work[i + 1] = colorizeLut[o + 1];
      work[i + 2] = colorizeLut[o + 2];
    }
  } else if (col.mode === 'palettize') {
    const colorPal = resolvePaletteColors(
      col.colorPalettize.paletteId,
      allPalettes,
      BUILTIN_COLOR_PALETTES,
    );
    applyPalettize(work, width, height, col.colorPalettize, colorPal);
  } else if (col.mode === 'gradientMap') {
    const lut = buildGradientLut(
      col.gradientMapStops,
      col.gradientMapSpace,
      col.gradientMapReverse,
    );
    for (let i = 0; i < work.length; i += 4) {
      const lum = clamp255(luminance709(work[i], work[i + 1], work[i + 2]));
      const o = lum * 3;
      work[i] = lut[o];
      work[i + 1] = lut[o + 1];
      work[i + 2] = lut[o + 2];
    }
  } else if (col.mode === 'gradientOverlay') {
    const lut = buildGradientLut(col.overlayStops, 'rgb', col.overlayReverse);
    const op = clamp01(col.overlayOpacity);
    const invOp = 1 - op;
    const invW = width > 1 ? 1 / (width - 1) : 0;
    const invH = height > 1 ? 1 / (height - 1) : 0;
    const mode = col.overlayBlendMode;

    let idx = 0;
    for (let y = 0; y < height; y++) {
      const ny = y * invH;
      for (let x = 0; x < width; x++) {
        const nx = x * invW;
        const t = sampleGradientShape(
          nx,
          ny,
          col.overlayShape,
          col.overlayAngle,
          col.overlayCenterX,
          col.overlayCenterY,
          col.overlayScale,
        );
        const lutIdx = clamp255(t * 255) * 3;
        const gr = lut[lutIdx];
        const gg = lut[lutIdx + 1];
        const gb = lut[lutIdx + 2];

        const br = work[idx];
        const bg = work[idx + 1];
        const bb = work[idx + 2];

        let blendedR: number;
        let blendedG: number;
        let blendedB: number;

        if (mode === 'color') {
          const [gh, gs] = rgbToHsl(gr, gg, gb);
          const [, , bl] = rgbToHsl(br, bg, bb);
          [blendedR, blendedG, blendedB] = hslToRgb(gh, gs, bl);
        } else {
          blendedR = blendChannel(br, gr, mode);
          blendedG = blendChannel(bg, gg, mode);
          blendedB = blendChannel(bb, gb, mode);
        }

        work[idx] = clamp255(br * invOp + blendedR * op);
        work[idx + 1] = clamp255(bg * invOp + blendedG * op);
        work[idx + 2] = clamp255(bb * invOp + blendedB * op);
        idx += 4;
      }
    }
  }

  // Re-apply custom (non-#000000 / non-#ffffff) Shadow & Highlight threshold tints on top of
  // Colouring (when Colouring is active) so Step 3's custom tint pickers aren't wiped out by
  // HSV / Gradient Map / Palettize, while still feeding into Curves, Noise & Posterize.
  if (col.mode !== 'none') {
    if (config.thresholds.blackEnabled && hasCustomBlackTint && config.thresholds.blackOpacity > 0) {
      const op = clamp01(config.thresholds.blackOpacity);
      const invOp = 1 - op;
      for (let p = 0, i = 0; i < work.length; p++, i += 4) {
        if (baseLuminance[p] <= blackThresh) {
          work[i] = clamp255(work[i] * invOp + blackRgb[0] * op);
          work[i + 1] = clamp255(work[i + 1] * invOp + blackRgb[1] * op);
          work[i + 2] = clamp255(work[i + 2] * invOp + blackRgb[2] * op);
        }
      }
    }
    if (config.thresholds.whiteEnabled && hasCustomWhiteTint && config.thresholds.whiteOpacity > 0) {
      const op = clamp01(config.thresholds.whiteOpacity);
      const invOp = 1 - op;
      for (let p = 0, i = 0; i < work.length; p++, i += 4) {
        if (baseLuminance[p] >= whiteThresh) {
          work[i] = clamp255(work[i] * invOp + whiteRgb[0] * op);
          work[i + 1] = clamp255(work[i + 1] * invOp + whiteRgb[1] * op);
          work[i + 2] = clamp255(work[i + 2] * invOp + whiteRgb[2] * op);
        }
      }
    }
  }

  // Capture live luminance histogram right before Tone Curves so CurveEditor displays real input
  histogram = computeHistogram(work);

  // Color Adjustment Curves (Page 6)
  if (col.curvesEnabled && col.curvePoints.length >= 2) {
    const curveLut = buildCurveLut(col.curvePoints);
    for (let i = 0; i < work.length; i += 4) {
      work[i] = curveLut[work[i]];
      work[i + 1] = curveLut[work[i + 1]];
      work[i + 2] = curveLut[work[i + 2]];
    }
  }

  if (targetStage === 'colour') {
    return finish(work);
  }

  // Stage 6: G'MIC-Qt Additive Noise (Page 7)
  if (config.noise.enabled && config.noise.amplitude > 0) {
    applyAdditiveNoise(work, config.noise);
  }
  if (targetStage === 'noise') {
    return finish(work);
  }

  // Stage 7: Posterize (Final Step, Page 8)
  if (config.posterize.enabled) {
    applyPosterize(work, config.posterize.levels);
  }

  return finish(work);
}
