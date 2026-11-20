import type { CurvePoint } from '../types';
import { clamp255 } from './colorSpace';

export interface CurvePreset {
  id: string;
  name: string;
  nameZh: string;
  points: CurvePoint[];
}

export const CURVE_PRESETS: CurvePreset[] = [
  {
    id: 'linear',
    name: 'Linear',
    nameZh: '线性（无调整）',
    points: [
      { x: 0, y: 0 },
      { x: 255, y: 255 },
    ],
  },
  {
    id: 'zato_contrast',
    name: 'ZATO Contrast (PDF p.6)',
    nameZh: 'ZATO 高反差（教程 P6）',
    // Modeled directly after zaterr.pdf page 6: Input 64 -> Output 0, lifted highlights
    points: [
      { x: 0, y: 0 },
      { x: 64, y: 0 },
      { x: 196, y: 214 },
      { x: 255, y: 255 },
    ],
  },
  {
    id: 's_punch',
    name: 'S-Curve Punch',
    nameZh: 'S 曲线对比增强',
    points: [
      { x: 0, y: 0 },
      { x: 56, y: 24 },
      { x: 128, y: 128 },
      { x: 200, y: 230 },
      { x: 255, y: 255 },
    ],
  },
  {
    id: 'deep_crush',
    name: 'Deep Shadow Crush',
    nameZh: '暗部压死',
    points: [
      { x: 0, y: 0 },
      { x: 84, y: 0 },
      { x: 170, y: 155 },
      { x: 255, y: 255 },
    ],
  },
  {
    id: 'lifted_film',
    name: 'Lifted Soviet Film',
    nameZh: '苏联胶片微灰',
    points: [
      { x: 0, y: 14 },
      { x: 70, y: 42 },
      { x: 185, y: 215 },
      { x: 255, y: 245 },
    ],
  },
];

/**
 * Builds a 256-entry Tone Curve LUT using Fritsch-Carlson monotone cubic Hermite interpolation,
 * matching Krita's Color Adjustment Curves smoothness without ringing overshoot.
 */
export function buildCurveLut(rawPoints: CurvePoint[]): Uint8Array {
  const lut = new Uint8Array(256);
  if (!rawPoints || rawPoints.length === 0) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  // Sort by x and deduplicate identical x coordinates
  const sorted = [...rawPoints]
    .map((p) => ({
      x: Math.max(0, Math.min(255, p.x)),
      y: Math.max(0, Math.min(255, p.y)),
    }))
    .sort((a, b) => a.x - b.x);

  const pts: CurvePoint[] = [];
  for (const p of sorted) {
    if (pts.length > 0 && Math.abs(pts[pts.length - 1].x - p.x) < 1e-4) {
      pts[pts.length - 1] = p;
    } else {
      pts.push(p);
    }
  }

  const n = pts.length;
  if (n === 1) {
    lut.fill(clamp255(pts[0].y));
    return lut;
  }

  const dx = new Float64Array(n - 1);
  const dy = new Float64Array(n - 1);
  const slopes = new Float64Array(n - 1);

  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    dy[i] = pts[i + 1].y - pts[i].y;
    slopes[i] = dx[i] > 0 ? dy[i] / dx[i] : 0;
  }

  const m = new Float64Array(n);
  m[0] = slopes[0];
  m[n - 1] = slopes[n - 2];

  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / slopes[i - 1] + w2 / slopes[i]);
    }
  }

  // Fritsch-Carlson monotonicity clamping
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(slopes[i]) < 1e-9) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / slopes[i];
      const b = m[i + 1] / slopes[i];
      const h = Math.hypot(a, b);
      if (h > 3) {
        const t = 3 / h;
        m[i] = t * a * slopes[i];
        m[i + 1] = t * b * slopes[i];
      }
    }
  }

  let seg = 0;
  for (let x = 0; x < 256; x++) {
    if (x <= pts[0].x) {
      lut[x] = clamp255(pts[0].y);
      continue;
    }
    if (x >= pts[n - 1].x) {
      lut[x] = clamp255(pts[n - 1].y);
      continue;
    }
    while (seg < n - 2 && x > pts[seg + 1].x) {
      seg++;
    }
    const h = dx[seg];
    const t = h > 0 ? (x - pts[seg].x) / h : 0;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    const y = h00 * pts[seg].y + h10 * h * m[seg] + h01 * pts[seg + 1].y + h11 * h * m[seg + 1];
    lut[x] = clamp255(y);
  }

  return lut;
}
