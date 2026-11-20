/**
 * Fast, deterministic PRNG and spatial pixel noise hash for Krita-like
 * noise dithering and G'MIC Gaussian/Uniform additive noise.
 */

export function createMulberry32(seed: number): () => number {
  let state = (seed | 0) + 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Spatial hash returning a uniform float in [0, 1) with zero visible grid correlation.
 */
export function hashPixelChannel(x: number, y: number, channel: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(channel | 0, 2147483647) + Math.imul(seed | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

/**
 * Stateful Box-Muller Gaussian generator (mean 0, stddev 1).
 */
export function createGaussianRng(seed: number): () => number {
  const rand = createMulberry32(seed);
  let hasSpare = false;
  let spare = 0;

  return () => {
    if (hasSpare) {
      hasSpare = false;
      return spare;
    }
    let u = 0;
    let v = 0;
    while (u <= 1e-12) u = rand();
    v = rand();
    const mag = Math.sqrt(-2.0 * Math.log(u));
    const angle = 2.0 * Math.PI * v;
    spare = mag * Math.sin(angle);
    hasSpare = true;
    return mag * Math.cos(angle);
  };
}

// Bayer ordered dithering matrices normalized to [0, 1)
export const BAYER_4X4 = new Float32Array([
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
].map((v) => (v + 0.5) / 16));

export const BAYER_8X8 = new Float32Array([
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
].map((v) => (v + 0.5) / 64));
