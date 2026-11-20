import type { GradientInterpSpace, GradientShape, GradientStop } from '../types';
import { clamp01, clamp255, hexToRgb, labToRgb, rgbToLab } from './colorSpace';

export interface GradientPreset {
  id: string;
  name: string;
  nameZh: string;
  stops: GradientStop[];
}

export const GRADIENT_MAP_PRESETS: GradientPreset[] = [
  {
    id: 'streetlight_night',
    name: 'Winter Streetlights (PDF p.5)',
    nameZh: '冬夜路灯雪街（教程 P5）',
    stops: [
      { id: 's1', position: 0.0, color: '#000000' },
      { id: 's2', position: 0.24, color: '#081838' },
      { id: 's3', position: 0.56, color: '#2f65a3' },
      { id: 's4', position: 0.82, color: '#a5c6e5' },
      { id: 's5', position: 1.0, color: '#ffffff' },
    ],
  },
  {
    id: 'electric_cyan',
    name: 'Electric Cyan Canopy (PDF p.11)',
    nameZh: '电光青林冠（教程 P11）',
    stops: [
      { id: 's1', position: 0.0, color: '#000611' },
      { id: 's2', position: 0.33, color: '#00426d' },
      { id: 's3', position: 0.66, color: '#11a7c4' },
      { id: 's4', position: 0.90, color: '#d6f8ff' },
      { id: 's5', position: 1.0, color: '#ffffff' },
    ],
  },
  {
    id: 'palace_violet',
    name: 'Palace of Culture Violet (PDF p.5)',
    nameZh: '文化宫紫灰（教程 P5）',
    stops: [
      { id: 's1', position: 0.0, color: '#070309' },
      { id: 's2', position: 0.30, color: '#3b204d' },
      { id: 's3', position: 0.65, color: '#a682b8' },
      { id: 's4', position: 0.92, color: '#eadcf4' },
      { id: 's5', position: 1.0, color: '#ffffff' },
    ],
  },
  {
    id: 'door_amber',
    name: 'Apartment Door Amber (PDF p.4)',
    nameZh: '公寓门暖琥珀（教程 P4）',
    stops: [
      { id: 's1', position: 0.0, color: '#110602' },
      { id: 's2', position: 0.32, color: '#6b2e0e' },
      { id: 's3', position: 0.68, color: '#da9856' },
      { id: 's4', position: 1.0, color: '#fbf0dc' },
    ],
  },
  {
    id: 'door_sage',
    name: 'Apartment Door Sage (PDF p.4)',
    nameZh: '公寓门冷苔绿（教程 P4）',
    stops: [
      { id: 's1', position: 0.0, color: '#050b04' },
      { id: 's2', position: 0.35, color: '#2b4222' },
      { id: 's3', position: 0.72, color: '#9ab486' },
      { id: 's4', position: 1.0, color: '#edf6e4' },
    ],
  },
  {
    id: 'soviet_crimson',
    name: 'Red Signal Archive',
    nameZh: '红色警报档案',
    stops: [
      { id: 's1', position: 0.0, color: '#080102' },
      { id: 's2', position: 0.35, color: '#5c121e' },
      { id: 's3', position: 0.72, color: '#c45a68' },
      { id: 's4', position: 1.0, color: '#f7e6e8' },
    ],
  },
];

export const OVERLAY_GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: 'canopy_violet',
    name: 'Canopy Violet (PDF p.12)',
    nameZh: '林冠紫渐层（教程 P12）',
    stops: [
      { id: 'o1', position: 0.0, color: '#451a6e' },
      { id: 'o2', position: 0.55, color: '#7a45a8' },
      { id: 'o3', position: 1.0, color: '#b487d8' },
    ],
  },
  {
    id: 'mosaic_crimson',
    name: 'Mosaic Rose Shadow (PDF p.5)',
    nameZh: '马赛克暗红渐层（教程 P5）',
    stops: [
      { id: 'o1', position: 0.0, color: '#b87a84' },
      { id: 'o2', position: 0.6, color: '#7a3542' },
      { id: 'o3', position: 1.0, color: '#2a0b12' },
    ],
  },
  {
    id: 'sodium_blue',
    name: 'Sodium Warm to Cold Blue',
    nameZh: '冷蓝与钠灯暖光',
    stops: [
      { id: 'o1', position: 0.0, color: '#25528c' },
      { id: 'o2', position: 0.5, color: '#6b5378' },
      { id: 'o3', position: 1.0, color: '#b87d48' },
    ],
  },
  {
    id: 'emerald_dusk',
    name: 'Emerald Dusk',
    nameZh: '青绿暮色',
    stops: [
      { id: 'o1', position: 0.0, color: '#1b5e54' },
      { id: 'o2', position: 1.0, color: '#8ab89c' },
    ],
  },
];

/**
 * Builds a 256-entry RGB LUT (length 768 Uint8Array) for a multi-stop gradient
 * in either sRGB or CIE Lab interpolation space.
 */
export function buildGradientLut(
  rawStops: GradientStop[],
  space: GradientInterpSpace = 'rgb',
  reverse = false,
): Uint8Array {
  const lut = new Uint8Array(256 * 3);
  const sorted = [...rawStops]
    .map((s) => ({
      position: clamp01(s.position),
      rgb: hexToRgb(s.color),
    }))
    .sort((a, b) => a.position - b.position);

  if (sorted.length === 0) {
    for (let i = 0; i < 256; i++) {
      const v = reverse ? 255 - i : i;
      lut[i * 3] = v;
      lut[i * 3 + 1] = v;
      lut[i * 3 + 2] = v;
    }
    return lut;
  }

  const stopsLab = space === 'lab' ? sorted.map((s) => rgbToLab(s.rgb[0], s.rgb[1], s.rgb[2])) : null;

  for (let i = 0; i < 256; i++) {
    const t = reverse ? 1 - i / 255 : i / 255;
    let r = 0, g = 0, b = 0;

    if (t <= sorted[0].position || sorted.length === 1) {
      [r, g, b] = sorted[0].rgb;
    } else if (t >= sorted[sorted.length - 1].position) {
      [r, g, b] = sorted[sorted.length - 1].rgb;
    } else {
      let seg = 0;
      while (seg < sorted.length - 2 && t > sorted[seg + 1].position) {
        seg++;
      }
      const s0 = sorted[seg];
      const s1 = sorted[seg + 1];
      const span = s1.position - s0.position;
      const f = span > 1e-6 ? (t - s0.position) / span : 0;

      if (stopsLab) {
        const l0 = stopsLab[seg];
        const l1 = stopsLab[seg + 1];
        [r, g, b] = labToRgb(
          l0[0] + (l1[0] - l0[0]) * f,
          l0[1] + (l1[1] - l0[1]) * f,
          l0[2] + (l1[2] - l0[2]) * f,
        );
      } else {
        r = clamp255(s0.rgb[0] + (s1.rgb[0] - s0.rgb[0]) * f);
        g = clamp255(s0.rgb[1] + (s1.rgb[1] - s0.rgb[1]) * f);
        b = clamp255(s0.rgb[2] + (s1.rgb[2] - s0.rgb[2]) * f);
      }
    }

    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
  }

  return lut;
}

/**
 * Evaluates a normalized 2D gradient coordinate t in [0, 1] matching Krita's Gradient Tool shapes
 * shown on zaterr.pdf Page 12 (Linear, Bi-Linear, Radial, Square, Conical).
 */
export function sampleGradientShape(
  nx: number, // 0..1
  ny: number, // 0..1
  shape: GradientShape,
  angleDeg: number,
  centerX: number,
  centerY: number,
  scale: number,
): number {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const invScale = 1 / Math.max(0.05, scale);

  const dx = (nx - centerX) * invScale;
  const dy = (ny - centerY) * invScale;

  switch (shape) {
    case 'linear': {
      const proj = dx * cos + dy * sin;
      return clamp01(proj + 0.5);
    }
    case 'bilinear': {
      const proj = Math.abs(dx * cos + dy * sin);
      return clamp01(proj * 2);
    }
    case 'radial': {
      const dist = Math.hypot(dx, dy) * 2;
      return clamp01(dist);
    }
    case 'square': {
      const rx = Math.abs(dx * cos + dy * sin);
      const ry = Math.abs(-dx * sin + dy * cos);
      return clamp01(Math.max(rx, ry) * 2);
    }
    case 'conical': {
      const a = Math.atan2(dy, dx) - rad;
      let norm = ((a / (2 * Math.PI)) % 1 + 1) % 1;
      // Symmetric conical sweep (0 -> 1 -> 0)
      norm = norm <= 0.5 ? norm * 2 : (1 - norm) * 2;
      return clamp01(norm);
    }
  }
}

export function stopsToCssLinearGradient(stops: GradientStop[], reverse = false): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  if (sorted.length === 0) return 'linear-gradient(90deg, #000, #fff)';
  const parts = sorted.map((s) => {
    const pos = reverse ? 1 - s.position : s.position;
    return { pos, color: s.color };
  });
  parts.sort((a, b) => a.pos - b.pos);
  return `linear-gradient(90deg, ${parts.map((p) => `${p.color} ${(p.pos * 100).toFixed(1)}%`).join(', ')})`;
}
