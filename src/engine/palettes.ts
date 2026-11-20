import type { NamedPalette, RGB } from '../types';
import { clamp255, hexToRgb, luminance709, rgbToHex } from './colorSpace';

/**
 * Generates Krita's iconic "Default" style palette containing both rich grey tones
 * and muted/chromatic colors, matching zaterr.pdf Page 2:
 * "I recommend choosing a palette that has a lot of colours and grey tones"
 */
function buildKritaDefaultColors(): string[] {
  const colors: string[] = [];
  // 17 pure neutral gray steps (black to white)
  for (let i = 0; i <= 16; i++) {
    const v = Math.round((i / 16) * 255);
    colors.push(rgbToHex(v, v, v));
  }
  // Subtle warm & cool desaturated mid-greys (create that authentic Krita Lab dither texture)
  const nearGreys: RGB[] = [
    [28, 30, 34], [52, 55, 60], [78, 82, 88], [106, 110, 118], [138, 142, 150], [176, 180, 188], [214, 218, 224],
    [34, 30, 27], [60, 54, 49], [88, 82, 76], [118, 112, 104], [150, 144, 134], [188, 182, 172], [224, 218, 208],
    [32, 36, 30], [58, 64, 54], [86, 94, 80], [116, 124, 108], [148, 156, 140], [184, 192, 178],
  ];
  for (const [r, g, b] of nearGreys) colors.push(rgbToHex(r, g, b));

  // Rich chromatic ramp (12 hues x 4 tone tiers) like Krita's Default / Concept&Illustration palette
  const hues = [0, 30, 55, 95, 140, 180, 205, 235, 270, 300, 330];
  const tiers: Array<[number, number]> = [
    [0.22, 0.35],
    [0.42, 0.50],
    [0.62, 0.45],
    [0.80, 0.30],
  ];
  for (const h of hues) {
    for (const [l, s] of tiers) {
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = l - c / 2;
      let r = 0, g = 0, b = 0;
      if (h < 60) [r, g, b] = [c, x, 0];
      else if (h < 120) [r, g, b] = [x, c, 0];
      else if (h < 180) [r, g, b] = [0, c, x];
      else if (h < 240) [r, g, b] = [0, x, c];
      else if (h < 300) [r, g, b] = [x, 0, c];
      else [r, g, b] = [c, 0, x];
      colors.push(rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255));
    }
  }
  return Array.from(new Set(colors));
}

export const BUILTIN_BASE_PALETTES: NamedPalette[] = [
  {
    id: 'krita_default',
    name: 'Default Full Spectrum (Colors + Greys)',
    nameZh: '默认全谱色板（多色彩 + 丰富灰阶）',
    colors: buildKritaDefaultColors(),
    source: 'builtin',
  },
  {
    id: 'grey_16',
    name: 'Pure Grayscale (16 tones)',
    nameZh: '纯灰阶 16 级',
    colors: Array.from({ length: 16 }, (_, i) => {
      const v = Math.round((i / 15) * 255);
      return rgbToHex(v, v, v);
    }),
    source: 'builtin',
  },
  {
    id: 'grey_8',
    name: 'Coarse Grayscale (8 tones)',
    nameZh: '粗颗粒灰阶 8 级',
    colors: Array.from({ length: 8 }, (_, i) => {
      const v = Math.round((i / 7) * 255);
      return rgbToHex(v, v, v);
    }),
    source: 'builtin',
  },
  {
    id: 'warm_cool_grey',
    name: 'Archival Film Greys (24 tones)',
    nameZh: '档案胶片冷暖灰 24 阶',
    colors: [
      '#000000', '#121316', '#1e1d1c', '#242a26', '#2b2d32', '#3a3937',
      '#465048', '#4d443c', '#4a4d54', '#5b5a56', '#6b6f77', '#6e7a70',
      '#7d7b75', '#8c9199', '#96a298', '#9d9b94', '#adb2ba', '#bebcb5',
      '#c1cbc2', '#cfd3da', '#d7d0c4', '#dfddd6', '#eef0f4', '#ffffff',
    ],
    source: 'builtin',
  },
];

export const BUILTIN_COLOR_PALETTES: NamedPalette[] = [
  {
    id: 'zato_moss',
    name: 'ZATO Forest Moss (PDF p.9)',
    nameZh: 'ZATO 森林苔绿（教程 P9 风格）',
    colors: [
      '#000000', '#0b1209', '#162211', '#25361d', '#3a4e2c', '#53693f',
      '#6f8558', '#8ea175', '#b0be98', '#d3dcc2', '#eef2e4', '#ffffff',
    ],
    source: 'builtin',
  },
  {
    id: 'zato_palace_violet',
    name: 'Palace of Culture Violet (PDF p.5)',
    nameZh: '文化宫紫罗兰（教程 P5/P10）',
    colors: [
      '#000000', '#140c18', '#271730', '#3d254b', '#573968', '#735187',
      '#906ea4', '#ae8ec1', '#cab0da', '#e3d3ee', '#f5eefb', '#ffffff',
    ],
    source: 'builtin',
  },
  {
    id: 'zato_winter_blue',
    name: 'Winter Streetlight Blue (PDF p.5)',
    nameZh: '冬夜路灯蓝（教程 P5）',
    colors: [
      '#000000', '#040a18', '#0a1936', '#142d5a', '#21457d', '#36619c',
      '#5481b8', '#7aa4d1', '#a6c6e5', '#d3e5f5', '#eef6fc', '#ffffff',
    ],
    source: 'builtin',
  },
  {
    id: 'zato_mosaic_rose',
    name: 'Soviet Mosaic Crimson (PDF p.5)',
    nameZh: '苏联马赛克暗红（教程 P5）',
    colors: [
      '#000000', '#18090b', '#2e1318', '#492028', '#65313a', '#834952',
      '#a0656d', '#bc858c', '#d5a8ae', '#eaccce', '#f8ebec', '#ffffff',
    ],
    source: 'builtin',
  },
  {
    id: 'zato_door_amber',
    name: 'Apartment Door Amber (PDF p.4)',
    nameZh: '公寓门暖琥珀（教程 P4）',
    colors: [
      '#0d0502', '#231006', '#45210b', '#6d3914', '#975824', '#be7f42',
      '#dda96f', '#f0cf9f', '#f8e7ca', '#fdf6e9',
    ],
    source: 'builtin',
  },
  {
    id: 'zato_door_cyan',
    name: 'Apartment Door Cyan (PDF p.4)',
    nameZh: '公寓门冷青（教程 P4）',
    colors: [
      '#020a0d', '#061a20', '#0d323c', '#19505e', '#2d7282', '#4c97a6',
      '#78bcc8', '#abdce4', '#d9f4f8', '#f2fcfd',
    ],
    source: 'builtin',
  },
  {
    id: 'zato_crt_phosphor',
    name: 'CRT Phosphor Terminal',
    nameZh: 'CRT 荧光绿终端',
    colors: [
      '#000000', '#04140a', '#0a2915', '#134424', '#216337', '#38874f',
      '#59ab6e', '#86cc95', '#b9e6c1', '#e4f7e7', '#ffffff',
    ],
    source: 'builtin',
  },
  {
    id: 'zato_soviet_sepia',
    name: 'Concrete & Rust Archival',
    nameZh: '混凝土与铁锈档案',
    colors: [
      '#000000', '#1a1410', '#332820', '#4f3f33', '#6e5a4b', '#8d7866',
      '#ac9784', '#c9b8a6', '#e2d7ca', '#f4efe9', '#ffffff',
    ],
    source: 'builtin',
  },
];

export function sortPaletteByLuminance(colors: string[]): string[] {
  return [...colors].sort((a, b) => {
    const [ra, ga, ba] = hexToRgb(a);
    const [rb, gb, bb] = hexToRgb(b);
    return luminance709(ra, ga, ba) - luminance709(rb, gb, bb);
  });
}

export function getAllBuiltinPalettes(): NamedPalette[] {
  return [...BUILTIN_BASE_PALETTES, ...BUILTIN_COLOR_PALETTES];
}

/**
 * Parse .PAL (JASC-PAL text or Microsoft RIFF PAL binary), .GPL (GIMP/Krita), or .HEX/.TXT
 * palette files, mirroring Lospec & Aseprite export formats referenced on Pages 9-10.
 */
export function parsePaletteFile(
  fileName: string,
  buffer: ArrayBuffer,
): { name: string; colors: string[] } {
  const bytes = new Uint8Array(buffer);
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'Imported Palette';

  // Detect Microsoft RIFF PAL binary format: "RIFF" ... "PAL "
  if (
    bytes.length >= 28 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x50 && bytes[9] === 0x41 && bytes[10] === 0x4c && bytes[11] === 0x20
  ) {
    const view = new DataView(buffer);
    // Find 'data' chunk
    let offset = 12;
    const colors: string[] = [];
    while (offset + 8 <= bytes.length) {
      const chunkId = String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
      );
      const chunkSize = view.getUint32(offset + 4, true);
      if (chunkId === 'data' && offset + 12 <= bytes.length) {
        const count = view.getUint16(offset + 10, true);
        let pos = offset + 12;
        for (let i = 0; i < count && pos + 3 < bytes.length; i++, pos += 4) {
          colors.push(rgbToHex(bytes[pos], bytes[pos + 1], bytes[pos + 2]));
        }
        break;
      }
      offset += 8 + chunkSize + (chunkSize % 2);
    }
    return { name: baseName, colors: dedupeColors(colors) };
  }

  const text = new TextDecoder('utf-8').decode(bytes);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // JASC-PAL format (Lospec & Aseprite standard .PAL)
  if (lines[0]?.toUpperCase() === 'JASC-PAL') {
    const colors: string[] = [];
    for (let i = 3; i < lines.length; i++) {
      const parts = lines[i].split(/\s+/);
      if (parts.length >= 3) {
        const r = Number(parts[0]);
        const g = Number(parts[1]);
        const b = Number(parts[2]);
        if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
          colors.push(rgbToHex(r, g, b));
        }
      }
    }
    return { name: baseName, colors: dedupeColors(colors) };
  }

  // GIMP / Krita Palette (.gpl)
  if (lines[0]?.startsWith('GIMP Palette')) {
    let parsedName = baseName;
    const colors: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('#')) continue;
      if (line.toLowerCase().startsWith('name:')) {
        const n = line.slice(5).trim();
        if (n) parsedName = n;
        continue;
      }
      if (line.toLowerCase().startsWith('columns:')) continue;
      const match = line.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/);
      if (match) {
        colors.push(rgbToHex(Number(match[1]), Number(match[2]), Number(match[3])));
      }
    }
    return { name: parsedName, colors: dedupeColors(colors) };
  }

  // Fallback: .hex / plain text hex codes or RGB triplets
  const colors: string[] = [];
  for (const line of lines) {
    if (line.startsWith('#') || /^[0-9a-fA-F]{6}$/.test(line) || /^#[0-9a-fA-F]{3,6}$/.test(line)) {
      const hexMatches = line.match(/#?[0-9a-fA-F]{6}\b/g);
      if (hexMatches) {
        for (const m of hexMatches) {
          const clean = m.startsWith('#') ? m : `#${m}`;
          colors.push(clean.toLowerCase());
        }
        continue;
      }
    }
    const rgbMatch = line.match(/^(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})/);
    if (rgbMatch) {
      colors.push(rgbToHex(Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])));
    }
  }

  return { name: baseName, colors: dedupeColors(colors) };
}

function dedupeColors(colors: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of colors) {
    const norm = c.toLowerCase();
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

/**
 * Exports a palette to JASC-PAL (.pal) format compatible with Krita & Aseprite (Pages 9-10).
 */
export function exportJascPal(colors: string[]): string {
  const lines = ['JASC-PAL', '0100', String(colors.length)];
  for (const hex of colors) {
    const [r, g, b] = hexToRgb(hex);
    lines.push(`${r} ${g} ${b}`);
  }
  return lines.join('\r\n') + '\r\n';
}

/**
 * Exports a palette to GIMP / Krita (.gpl) format.
 */
export function exportGimpGpl(name: string, colors: string[]): string {
  const lines = ['GIMP Palette', `Name: ${name}`, 'Columns: 8', '#'];
  colors.forEach((hex, idx) => {
    const [r, g, b] = hexToRgb(hex);
    lines.push(
      `${String(r).padStart(3, ' ')} ${String(g).padStart(3, ' ')} ${String(b).padStart(3, ' ')}\tColor ${idx + 1}`,
    );
  });
  return lines.join('\n') + '\n';
}

/**
 * Median-Cut Color Quantizer that extracts a clean indexed palette from any reference image
 * (replacing Aseprite's Indexed Mode workflow from zaterr.pdf Page 10!).
 * Transparent pixels (alpha < 128) are automatically skipped so Krita never freaks out.
 */
export function extractPaletteFromRgba(
  rgba: Uint8ClampedArray,
  maxColors = 16,
  sortByLuminance = true,
): string[] {
  const targetCount = Math.max(2, Math.min(64, Math.round(maxColors)));
  const totalPixels = rgba.length >> 2;
  // Subsample large images cleanly to ~20,000 opaque samples
  const stride = Math.max(1, Math.floor(totalPixels / 20000));
  const samples: RGB[] = [];

  for (let p = 0; p < totalPixels; p += stride) {
    const i = p << 2;
    if (rgba[i + 3] < 128) continue; // Skip transparent pixels (Page 10 note!)
    samples.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
  }

  if (samples.length === 0) {
    return ['#000000', '#ffffff'];
  }

  interface Box {
    pixels: RGB[];
    rMin: number;
    rMax: number;
    gMin: number;
    gMax: number;
    bMin: number;
    bMax: number;
    range: number;
    longestChannel: 0 | 1 | 2;
  }

  function makeBox(pixels: RGB[]): Box {
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (let i = 0; i < pixels.length; i++) {
      const [r, g, b] = pixels[i];
      if (r < rMin) rMin = r;
      if (r > rMax) rMax = r;
      if (g < gMin) gMin = g;
      if (g > gMax) gMax = g;
      if (b < bMin) bMin = b;
      if (b > bMax) bMax = b;
    }
    const rRange = rMax - rMin;
    const gRange = gMax - gMin;
    const bRange = bMax - bMin;
    let longestChannel: 0 | 1 | 2 = 0;
    let range = rRange;
    if (gRange >= rRange && gRange >= bRange) {
      longestChannel = 1;
      range = gRange;
    } else if (bRange >= rRange && bRange >= gRange) {
      longestChannel = 2;
      range = bRange;
    }
    return { pixels, rMin, rMax, gMin, gMax, bMin, bMax, range, longestChannel };
  }

  const boxes: Box[] = [makeBox(samples)];

  while (boxes.length < targetCount) {
    // Pick splittable box with largest perceptual score (range * log2(count + 1))
    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.pixels.length < 2 || box.range === 0) continue;
      const score = box.range * Math.log2(box.pixels.length + 1);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;

    const target = boxes.splice(bestIdx, 1)[0];
    const ch = target.longestChannel;
    target.pixels.sort((a, b) => a[ch] - b[ch]);
    const mid = target.pixels.length >> 1;
    const left = target.pixels.slice(0, mid);
    const right = target.pixels.slice(mid);
    if (left.length > 0) boxes.push(makeBox(left));
    if (right.length > 0) boxes.push(makeBox(right));
  }

  const extracted: RGB[] = boxes.map((box) => {
    let rSum = 0, gSum = 0, bSum = 0;
    for (const [r, g, b] of box.pixels) {
      rSum += r;
      gSum += g;
      bSum += b;
    }
    const n = box.pixels.length;
    return [clamp255(rSum / n), clamp255(gSum / n), clamp255(bSum / n)];
  });

  if (sortByLuminance) {
    extracted.sort(
      (a, b) => luminance709(a[0], a[1], a[2]) - luminance709(b[0], b[1], b[2]),
    );
  }

  return dedupeColors(extracted.map(([r, g, b]) => rgbToHex(r, g, b)));
}
