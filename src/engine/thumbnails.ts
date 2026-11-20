import type { NamedPalette, ZatoPreset } from '../types';
import { runZatoPipeline } from './pipeline';
import { createDefaultConfig, mergeConfig } from './presets';

/**
 * Generates fast live thumbnail previews (132x56) of the user's current photo
 * for every ZATO preset so the preset gallery works like Apple Photos filters.
 */
export function generatePresetThumbnails(
  source: HTMLImageElement | HTMLCanvasElement,
  presets: ZatoPreset[],
  palettes: NamedPalette[],
): Record<string, string> {
  const thumbW = 132;
  const thumbH = 56;

  const srcW = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const srcH = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;

  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = thumbW;
  sampleCanvas.height = thumbH;
  const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true })!;
  sCtx.imageSmoothingEnabled = true;
  sCtx.imageSmoothingQuality = 'medium';

  // Cover-crop source cleanly into 132x56
  const scale = Math.max(thumbW / Math.max(1, srcW), thumbH / Math.max(1, srcH));
  const dw = srcW * scale;
  const dh = srcH * scale;
  sCtx.drawImage(source, (thumbW - dw) / 2, (thumbH - dh) / 2, dw, dh);
  const srcData = sCtx.getImageData(0, 0, thumbW, thumbH).data;
  const srcBuf = { width: thumbW, height: thumbH, data: srcData };

  const outCanvas = document.createElement('canvas');
  outCanvas.width = thumbW;
  outCanvas.height = thumbH;
  const oCtx = outCanvas.getContext('2d')!;
  const imgData = oCtx.createImageData(thumbW, thumbH);

  const base = createDefaultConfig();
  const result: Record<string, string> = {};

  for (const preset of presets) {
    const cfg = mergeConfig(base, preset.config);
    const res = runZatoPipeline(srcBuf, cfg, palettes, 'final');
    imgData.data.set(res.buffer.data);
    oCtx.putImageData(imgData, 0, 0);
    result[preset.id] = outCanvas.toDataURL('image/jpeg', 0.84);
  }

  return result;
}
