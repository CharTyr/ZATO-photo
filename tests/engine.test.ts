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
  sortPaletteByLuminance,
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

  it('renders vivid edited palette swatches (e.g. #e32400 red) cleanly on grayscale highlights in luminance ramp mode', () => {
    const editedPalettes = [
      ...getAllBuiltinPalettes(),
      {
        id: 'edited_cyan_red',
        name: 'Edited Cyan + Red',
        colors: ['#020a0d', '#0d323c', '#2d7282', '#e32400', '#e32400'],
        source: 'imported' as const,
      },
    ];
    // Pure bright white pixel should map to the last swatch (#e32400), NOT collapse back to dark teal!
    const bright: PixelBuffer = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([10, 10, 10, 255, 250, 250, 250, 255]),
    };
    const cfg = mergeConfig(createDefaultConfig(), {
      basePalettize: { enabled: false },
      thresholds: { blackEnabled: false, whiteEnabled: false },
      colouring: {
        mode: 'palettize',
        curvesEnabled: false,
        colorPalettize: {
          paletteId: 'edited_cyan_red',
          colorSpace: 'luminance',
          dither: false,
          thresholdMode: 'noise',
          seed: 1,
          spread: 1,
          colorMode: 'per_channel',
          offsetScale: 0,
        },
      },
      noise: { enabled: false },
      posterize: { enabled: false },
    });
    const res = runZatoPipeline(bright, cfg, editedPalettes, 'final');
    // Dark pixel -> #020a0d
    expect([res.buffer.data[0], res.buffer.data[1], res.buffer.data[2]]).toEqual([2, 10, 13]);
    // Bright pixel -> #e32400 (227, 36, 0)
    expect([res.buffer.data[4], res.buffer.data[5], res.buffer.data[6]]).toEqual([227, 36, 0]);
  });

  it('preserves custom Step 3 Shadow/Highlight tints across HSV, Gradient Map, and Palettize colouring', () => {
    const palettes = getAllBuiltinPalettes();
    const img: PixelBuffer = {
      width: 3,
      height: 1,
      data: new Uint8ClampedArray([
        12, 12, 12, 255, // shadow
        128, 128, 128, 255, // midtone
        245, 245, 245, 255, // highlight
      ]),
    };

    for (const mode of ['colourized', 'gradientMap', 'palettize'] as const) {
      const cfg = mergeConfig(createDefaultConfig(), {
        basePalettize: { enabled: false },
        thresholds: {
          blackEnabled: true,
          blackThreshold: 60,
          blackColor: '#e32400',
          blackOpacity: 1,
          whiteEnabled: true,
          whiteThreshold: 200,
          whiteColor: '#ffe08a',
          whiteOpacity: 1,
        },
        colouring: { mode, curvesEnabled: false },
        noise: { enabled: false },
        posterize: { enabled: false },
      });
      const res = runZatoPipeline(img, cfg, palettes, 'final');
      expect([res.buffer.data[0], res.buffer.data[1], res.buffer.data[2]]).toEqual([227, 36, 0]);
      expect([res.buffer.data[8], res.buffer.data[9], res.buffer.data[10]]).toEqual([255, 224, 138]);
    }
  });

  it('produces true 0/255 impulse dots for saltPepper noise even when valueAction is loop or normalize', () => {
    const palettes = getAllBuiltinPalettes();
    const gray: PixelBuffer = {
      width: 40,
      height: 10,
      data: new Uint8ClampedArray(40 * 10 * 4).fill(128),
    };
    for (let i = 3; i < gray.data.length; i += 4) gray.data[i] = 255;

    for (const valueAction of ['cut', 'loop', 'normalize'] as const) {
      const cfg = mergeConfig(createDefaultConfig(), {
        desaturate: { enabled: false },
        basePalettize: { enabled: false },
        thresholds: { blackEnabled: false, whiteEnabled: false },
        colouring: { mode: 'none', curvesEnabled: false },
        noise: { enabled: true, amplitude: 30, type: 'saltPepper', channel: 'rgba_all', valueAction, seed: 42 },
        posterize: { enabled: false },
      });
      const res = runZatoPipeline(gray, cfg, palettes, 'noise');
      let zeroCount = 0;
      let maxCount = 0;
      for (let i = 0; i < res.buffer.data.length; i += 4) {
        if (res.buffer.data[i] === 0) zeroCount++;
        if (res.buffer.data[i] === 255) maxCount++;
      }
      expect(zeroCount).toBeGreaterThan(5);
      expect(maxCount).toBeGreaterThan(5);
    }
  });

  it('scales conical gradient cleanly and sorts palettes dark-to-light', () => {
    const t1 = sampleGradientShape(0.8, 0.6, 'conical', 0, 0.5, 0.5, 1.0);
    const t2 = sampleGradientShape(0.8, 0.6, 'conical', 0, 0.5, 0.5, 0.5);
    expect(t2).toBeGreaterThan(t1);

    const sorted = sortPaletteByLuminance(['#ffffff', '#808080', '#000000']);
    expect(sorted).toEqual(['#000000', '#808080', '#ffffff']);
  });
});
