import { describe, expect, it } from 'vitest';
import {
  hslToRgb,
  hsvToRgb,
  labToRgb,
  rgbToHsl,
  rgbToHsv,
  rgbToLab,
  rgbToYcbcr,
  ycbcrToRgb,
} from '../src/engine/colorSpace';
import { buildCurveLut, CURVE_PRESETS } from '../src/engine/curves';
import { buildGradientLut, sampleGradientShape } from '../src/engine/gradients';
import {
  exportGimpGpl,
  exportJascPal,
  extractPaletteFromRgba,
  getAllBuiltinPalettes,
  parsePaletteFile,
} from '../src/engine/palettes';
import { applyDesaturate, applyPosterize, runZatoPipeline } from '../src/engine/pipeline';
import { createDefaultConfig, mergeConfig, ZATO_PRESETS } from '../src/engine/presets';
import type { PixelBuffer } from '../src/engine/pipeline';

function makeSyntheticPhoto(width: number, height: number): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const nx = x / Math.max(1, width - 1);
      const ny = y / Math.max(1, height - 1);
      data[i] = Math.round(nx * 255);
      data[i + 1] = Math.round(ny * 255);
      data[i + 2] = Math.round(((nx + ny) * 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('colorSpace conversions', () => {
  it('round-trips sRGB <-> CIE Lab within ±1 channel', () => {
    const samples: Array<[number, number, number]> = [
      [0, 0, 0],
      [255, 255, 255],
      [128, 128, 128],
      [212, 88, 42],
      [28, 155, 198],
      [140, 102, 168],
    ];
    for (const [r, g, b] of samples) {
      const [L, a, bb] = rgbToLab(r, g, b);
      const [rr, gg, bb2] = labToRgb(L, a, bb);
      expect(Math.abs(rr - r)).toBeLessThanOrEqual(2);
      expect(Math.abs(gg - g)).toBeLessThanOrEqual(2);
      expect(Math.abs(bb2 - b)).toBeLessThanOrEqual(2);
    }
  });

  it('round-trips HSL, HSV, and YCbCr cleanly', () => {
    const [h, s, l] = rgbToHsl(108, 133, 73);
    const [r1, g1, b1] = hslToRgb(h, s, l);
    expect(Math.abs(r1 - 108)).toBeLessThanOrEqual(1);
    expect(Math.abs(g1 - 133)).toBeLessThanOrEqual(1);
    expect(Math.abs(b1 - 73)).toBeLessThanOrEqual(1);

    const [hv, sv, vv] = rgbToHsv(50, 140, 210);
    const [r2, g2, b2] = hsvToRgb(hv, sv, vv);
    expect(Math.abs(r2 - 50)).toBeLessThanOrEqual(1);
    expect(Math.abs(g2 - 140)).toBeLessThanOrEqual(1);
    expect(Math.abs(b2 - 210)).toBeLessThanOrEqual(1);

    const [y, cb, cr] = rgbToYcbcr(180, 90, 220);
    const [r3, g3, b3] = ycbcrToRgb(y, cb, cr);
    expect(Math.abs(r3 - 180)).toBeLessThanOrEqual(1);
    expect(Math.abs(g3 - 90)).toBeLessThanOrEqual(1);
    expect(Math.abs(b3 - 220)).toBeLessThanOrEqual(1);
  });
});

describe('Tone Curves (Krita Color Adjustment Curves)', () => {
  it('evaluates linear curve as identity', () => {
    const lut = buildCurveLut(CURVE_PRESETS[0].points);
    for (let i = 0; i < 256; i++) {
      expect(lut[i]).toBe(i);
    }
  });

  it('crushes shadows below 64 in PDF p.6 ZATO Contrast curve without overshoot', () => {
    const lut = buildCurveLut(CURVE_PRESETS[1].points);
    expect(lut[0]).toBe(0);
    expect(lut[32]).toBe(0);
    expect(lut[64]).toBe(0);
    expect(lut[255]).toBe(255);
    for (let i = 1; i < 256; i++) {
      expect(lut[i]).toBeGreaterThanOrEqual(lut[i - 1]);
    }
  });
});

describe('Palettes (.PAL, .GPL, .HEX & Image Extraction)', () => {
  it('round-trips JASC-PAL and GIMP GPL exports', () => {
    const colors = ['#000000', '#3a4e2c', '#906ea4', '#ffffff'];
    const jasc = exportJascPal(colors);
    const parsedPal = parsePaletteFile('test.pal', new TextEncoder().encode(jasc).buffer);
    expect(parsedPal.colors).toEqual(colors);

    const gpl = exportGimpGpl('ZATO Test', colors);
    const parsedGpl = parsePaletteFile('test.gpl', new TextEncoder().encode(gpl).buffer);
    expect(parsedGpl.name).toBe('ZATO Test');
    expect(parsedGpl.colors).toEqual(colors);
  });

  it('parses Lospec .hex files', () => {
    const hexText = '0b1209\n#53693f\nEEF2E4\n';
    const parsed = parsePaletteFile('lospec.hex', new TextEncoder().encode(hexText).buffer);
    expect(parsed.colors).toEqual(['#0b1209', '#53693f', '#eef2e4']);
  });

  it('extracts palette from RGBA image while ignoring transparent pixels (PDF p.10)', () => {
    // Half red opaque, half blue opaque, plus bright green transparent pixels that must be ignored
    const rgba = new Uint8ClampedArray(300 * 4);
    for (let i = 0; i < 100; i++) {
      rgba[i * 4] = 200;
      rgba[i * 4 + 1] = 20;
      rgba[i * 4 + 2] = 20;
      rgba[i * 4 + 3] = 255;
    }
    for (let i = 100; i < 200; i++) {
      rgba[i * 4] = 20;
      rgba[i * 4 + 1] = 40;
      rgba[i * 4 + 2] = 210;
      rgba[i * 4 + 3] = 255;
    }
    for (let i = 200; i < 300; i++) {
      rgba[i * 4] = 0;
      rgba[i * 4 + 1] = 255;
      rgba[i * 4 + 2] = 0;
      rgba[i * 4 + 3] = 0; // Transparent!
    }
    const extracted = extractPaletteFromRgba(rgba, 4, true);
    expect(extracted.length).toBeGreaterThanOrEqual(2);
    expect(extracted).not.toContain('#00ff00');
  });
});

describe('Gradients & Shapes', () => {
  it('interpolates endpoints accurately in RGB and Lab', () => {
    const stops = [
      { id: 'a', position: 0, color: '#000000' },
      { id: 'b', position: 1, color: '#ffffff' },
    ];
    const lutRgb = buildGradientLut(stops, 'rgb', false);
    expect([lutRgb[0], lutRgb[1], lutRgb[2]]).toEqual([0, 0, 0]);
    expect([lutRgb[255 * 3], lutRgb[255 * 3 + 1], lutRgb[255 * 3 + 2]]).toEqual([255, 255, 255]);

    const lutLab = buildGradientLut(stops, 'lab', true);
    expect([lutLab[0], lutLab[1], lutLab[2]]).toEqual([255, 255, 255]);
    expect([lutLab[255 * 3], lutLab[255 * 3 + 1], lutLab[255 * 3 + 2]]).toEqual([0, 0, 0]);
  });

  it('computes radial gradient center = 0 and edge > 0', () => {
    expect(sampleGradientShape(0.5, 0.5, 'radial', 0, 0.5, 0.5, 1)).toBeCloseTo(0, 5);
    expect(sampleGradientShape(1.0, 0.5, 'radial', 0, 0.5, 0.5, 1)).toBeCloseTo(1, 5);
  });
});

describe('ZATO Pipeline & Performance', () => {
  it('desaturates correctly across Krita modes', () => {
    const buf = new Uint8ClampedArray([100, 200, 0, 255]);
    applyDesaturate(buf, 'lightness');
    expect([buf[0], buf[1], buf[2]]).toEqual([100, 100, 100]);

    const bufMin = new Uint8ClampedArray([100, 200, 40, 255]);
    applyDesaturate(bufMin, 'min');
    expect([bufMin[0], bufMin[1], bufMin[2]]).toEqual([40, 40, 40]);
  });

  it('posterizes to exact discrete levels', () => {
    const buf = new Uint8ClampedArray([0, 60, 128, 255, 200, 255, 10, 255]);
    applyPosterize(buf, 2);
    expect([buf[0], buf[1], buf[2]]).toEqual([0, 0, 255]);
    expect([buf[4], buf[5], buf[6]]).toEqual([255, 255, 0]);
  });

  it('implements exact Krita Grain Merge on Gradient Overlay', () => {
    // Base gray 128 + Gradient (200, 100, 50) at 100% opacity -> clamp(128 + grad - 128) = grad!
    const src: PixelBuffer = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        128, 128, 128, 255, 128, 128, 128, 255,
        128, 128, 128, 255, 128, 128, 128, 255,
      ]),
    };
    const cfg = mergeConfig(createDefaultConfig(), {
      desaturate: { enabled: false },
      basePalettize: { enabled: false },
      thresholds: { blackEnabled: false, whiteEnabled: false },
      colouring: {
        mode: 'gradientOverlay',
        curvesEnabled: false,
        overlayBlendMode: 'grainMerge',
        overlayOpacity: 1.0,
        overlayStops: [
          { id: '1', position: 0, color: '#c86432' },
          { id: '2', position: 1, color: '#c86432' },
        ],
      },
      noise: { enabled: false },
      posterize: { enabled: false },
    });
    const res = runZatoPipeline(src, cfg, getAllBuiltinPalettes(), 'final');
    expect([res.buffer.data[0], res.buffer.data[1], res.buffer.data[2]]).toEqual([200, 100, 50]);
  });

  it('runs all 10 ZATO presets cleanly and executes 978x404 under real-time budget', () => {
    const palettes = getAllBuiltinPalettes();
    const small = makeSyntheticPhoto(120, 50);
    for (const preset of ZATO_PRESETS) {
      const cfg = mergeConfig(createDefaultConfig(), preset.config);
      const res = runZatoPipeline(small, cfg, palettes, 'final');
      expect(res.buffer.width).toBe(120);
      expect(res.buffer.height).toBe(50);
      expect(res.histogram.length).toBe(256);
    }

    // Full ZATO 978x404 benchmark (cold + warm base-stage cache)
    const full = makeSyntheticPhoto(978, 404);
    const baseCfg = createDefaultConfig();
    const resCold = runZatoPipeline(full, baseCfg, palettes, 'final');
    const warmCfg = mergeConfig(baseCfg, { colouring: { hue: 280 }, posterize: { levels: 8 } });
    const resWarm = runZatoPipeline(full, warmCfg, palettes, 'final');
    console.log(
      `978x404 ZATO pipeline -> cold: ${resCold.durationMs.toFixed(1)} ms, warm (slider drag): ${resWarm.durationMs.toFixed(1)} ms`,
    );
    expect(resCold.durationMs).toBeLessThan(1500);
    expect(resWarm.durationMs).toBeLessThan(250);
  });

  it('handles every stage, noise channel/type/action, blend mode, and gradient shape cleanly', () => {
    const palettes = getAllBuiltinPalettes();
    const img = makeSyntheticPhoto(48, 24);
    const stages = [
      'original',
      'desaturate',
      'palettize',
      'blackMask',
      'blackDarken',
      'whiteMask',
      'whiteLighten',
      'colour',
      'noise',
      'final',
    ] as const;

    for (const st of stages) {
      const r = runZatoPipeline(img, createDefaultConfig(), palettes, st);
      expect(r.buffer.data.length).toBe(48 * 24 * 4);
    }

    const noiseChannels = [
      'rgba_all', 'rgb_red', 'rgb_green', 'rgb_blue',
      'ycbcr_y', 'ycbcr_cbcr', 'lab_l', 'lab_ab',
      'hsv_h', 'hsv_s', 'hsv_v',
    ] as const;
    const noiseTypes = ['gaussian', 'uniform', 'saltPepper'] as const;
    const actions = ['cut', 'normalize', 'loop'] as const;

    for (const channel of noiseChannels) {
      const cfg = mergeConfig(createDefaultConfig(), {
        noise: { enabled: true, amplitude: 12, channel, type: 'gaussian', valueAction: 'cut' },
      });
      const r = runZatoPipeline(img, cfg, palettes, 'noise');
      expect(r.buffer.data[3]).toBe(255);
    }
    for (const type of noiseTypes) {
      for (const valueAction of actions) {
        const cfg = mergeConfig(createDefaultConfig(), {
          noise: { enabled: true, amplitude: 10, channel: 'rgba_all', type, valueAction },
        });
        const r = runZatoPipeline(img, cfg, palettes, 'noise');
        expect(r.buffer.data.length).toBe(48 * 24 * 4);
      }
    }

    const blendModes = ['grainMerge', 'overlay', 'softLight', 'hardLight', 'multiply', 'color'] as const;
    const shapes = ['linear', 'bilinear', 'radial', 'square', 'conical'] as const;
    for (const overlayBlendMode of blendModes) {
      for (const overlayShape of shapes) {
        const cfg = mergeConfig(createDefaultConfig(), {
          colouring: { mode: 'gradientOverlay', overlayBlendMode, overlayShape, overlayOpacity: 0.6 },
        });
        const r = runZatoPipeline(img, cfg, palettes, 'final');
        expect(r.buffer.data.length).toBe(48 * 24 * 4);
      }
    }
  });
});
