import type { Lang, PipelineStageId } from './types';

export const STAGE_LABELS: Record<PipelineStageId, { zh: string; en: string; page: string }> = {
  original: { zh: '0. 原图', en: '0. Original', page: 'P.1' },
  desaturate: { zh: '1. 去色', en: '1. Desaturate', page: 'P.1' },
  palettize: { zh: '2. 调色板抖动', en: '2. Palettize', page: 'P.2' },
  blackMask: { zh: '3a. 纯黑遮罩', en: '3a. Black Mask', page: 'P.3' },
  blackDarken: { zh: '3b. 变暗 Darken', en: '3b. Darken', page: 'P.3' },
  whiteMask: { zh: '4a. 纯白遮罩', en: '4a. White Mask', page: 'P.4' },
  whiteLighten: { zh: '4b. 变亮 Lighten', en: '4b. Lighten', page: 'P.4' },
  colour: { zh: '5. 上色与曲线', en: '5. Colour & Curves', page: 'P.5–12' },
  noise: { zh: '6. 叠加噪点', en: '6. Noise', page: 'P.7' },
  final: { zh: '7. 最终成图', en: '7. Final (Posterize)', page: 'P.8' },
};

export function t(lang: Lang, zh: string, en: string): string {
  return lang === 'zh' ? zh : en;
}
