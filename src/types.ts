export type RGB = [number, number, number];

export type Lang = 'zh' | 'en';

export type ResizeMode = 'zato_978x404' | 'width_978' | 'original' | 'custom';
export type FitMode = 'cover' | 'contain' | 'stretch';

export type DesaturateMode =
  | 'lightness'
  | 'bt709'
  | 'bt601'
  | 'average'
  | 'min'
  | 'max';

export type PalettizeColorSpace = 'lab' | 'rgb';
export type DitherThresholdMode = 'noise' | 'bayer4' | 'bayer8';
export type DitherColorMode = 'per_channel' | 'luminance';

export type ColouringMode =
  | 'colourized'
  | 'palettize'
  | 'gradientMap'
  | 'gradientOverlay'
  | 'none';

export type GradientInterpSpace = 'rgb' | 'lab';
export type GradientShape = 'linear' | 'bilinear' | 'radial' | 'square' | 'conical';
export type OverlayBlendMode =
  | 'grainMerge'
  | 'overlay'
  | 'softLight'
  | 'hardLight'
  | 'multiply'
  | 'color';

export type NoiseType = 'gaussian' | 'uniform' | 'saltPepper';
export type NoiseChannel =
  | 'rgba_all'
  | 'rgb_red'
  | 'rgb_green'
  | 'rgb_blue'
  | 'ycbcr_y'
  | 'ycbcr_cbcr'
  | 'lab_l'
  | 'lab_ab'
  | 'hsv_h'
  | 'hsv_s'
  | 'hsv_v';
export type NoiseValueAction = 'cut' | 'normalize' | 'loop';

export type PipelineStageId =
  | 'original'
  | 'desaturate'
  | 'palettize'
  | 'blackMask'
  | 'blackDarken'
  | 'whiteMask'
  | 'whiteLighten'
  | 'colour'
  | 'noise'
  | 'final';

export interface CurvePoint {
  x: number; // 0..255
  y: number; // 0..255
}

export interface GradientStop {
  id: string;
  position: number; // 0..1
  color: string; // #rrggbb
}

export interface NamedPalette {
  id: string;
  name: string;
  nameZh?: string;
  colors: string[]; // #rrggbb
  source?: 'builtin' | 'imported' | 'extracted';
}

export interface PalettizeParams {
  enabled: boolean;
  paletteId: string;
  colorSpace: PalettizeColorSpace;
  dither: boolean;
  thresholdMode: DitherThresholdMode;
  seed: number;
  spread: number; // 0..1 (Krita default 1.0)
  colorMode: DitherColorMode;
  offsetScale: number; // 0..0.5 (Krita default 0.125)
}

export interface ZatoConfig {
  canvas: {
    resizeMode: ResizeMode;
    customWidth: number;
    customHeight: number;
    fitMode: FitMode;
    panX: number; // -1..1
    panY: number; // -1..1
    zoom: number; // 1..3
  };
  desaturate: {
    enabled: boolean;
    mode: DesaturateMode;
  };
  basePalettize: PalettizeParams;
  thresholds: {
    blackEnabled: boolean;
    blackThreshold: number; // 0..255
    blackColor: string; // default #000000
    blackOpacity: number; // 0..1
    whiteEnabled: boolean;
    whiteThreshold: number; // 0..255
    whiteColor: string; // default #ffffff
    whiteOpacity: number; // 0..1
  };
  colouring: {
    mode: ColouringMode;
    // HSV Colorize (Page 6)
    hue: number; // 0..360
    saturation: number; // 0..100
    lightness: number; // -50..50
    // Tone Curves / Color Adjustment Curves (Page 6)
    curvesEnabled: boolean;
    curvePoints: CurvePoint[];
    // Palettize Colorize (Pages 8-10)
    colorPalettize: Omit<PalettizeParams, 'enabled'>;
    // Gradient Map (Pages 5 & 11)
    gradientMapStops: GradientStop[];
    gradientMapSpace: GradientInterpSpace;
    gradientMapReverse: boolean;
    // Gradient Overlay + Grain Merge (Pages 5 & 12)
    overlayBlendMode: OverlayBlendMode;
    overlayOpacity: number; // 0..1 (default 0.60)
    overlayShape: GradientShape;
    overlayAngle: number; // 0..360
    overlayCenterX: number; // 0..1
    overlayCenterY: number; // 0..1
    overlayScale: number; // 0.2..2.5
    overlayReverse: boolean;
    overlayStops: GradientStop[];
  };
  noise: {
    enabled: boolean;
    amplitude: number; // 0..60 (default 7.6)
    type: NoiseType;
    channel: NoiseChannel;
    valueAction: NoiseValueAction;
    seed: number;
  };
  posterize: {
    enabled: boolean;
    levels: number; // 2..64
  };
}

export interface ZatoPreset {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  pdfRef: string;
  swatch: [string, string, string];
  config: PartialDeep<ZatoConfig>;
}

export type PartialDeep<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<U>
    : T[K] extends object
      ? PartialDeep<T[K]>
      : T[K];
};
