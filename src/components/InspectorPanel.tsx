import React, { useRef, useState } from 'react';
import { Dices, Eye, FileJson, FolderUp, Grid2x2, RotateCcw } from 'lucide-react';
import type {
  ColouringMode,
  DesaturateMode,
  DitherColorMode,
  DitherThresholdMode,
  FitMode,
  GradientInterpSpace,
  GradientShape,
  Lang,
  NamedPalette,
  NoiseChannel,
  NoiseType,
  NoiseValueAction,
  OverlayBlendMode,
  PalettizeColorSpace,
  PipelineStageId,
  ResizeMode,
  ZatoConfig,
} from '../types';
import { GRADIENT_MAP_PRESETS, OVERLAY_GRADIENT_PRESETS } from '../engine/gradients';
import { t } from '../i18n';
import type { ZoomMode } from './CanvasViewport';
import { CurveEditor } from './CurveEditor';
import { GradientEditor } from './GradientEditor';
import { PaletteManager } from './PaletteManager';
import { SliderField } from './ui/SliderField';
import { StepCard } from './ui/StepCard';

interface InspectorPanelProps {
  lang: Lang;
  config: ZatoConfig;
  palettes: NamedPalette[];
  histogram: Uint32Array;
  activeStage: PipelineStageId;
  zoom: ZoomMode;
  pixelated: boolean;
  renderMs: number;
  onChangeConfig: (updater: (prev: ZatoConfig) => ZatoConfig) => void;
  onAddPalette: (palette: NamedPalette) => void;
  onUpdatePaletteColors: (paletteId: string, colors: string[]) => void;
  onSelectStage: (stage: PipelineStageId) => void;
  onChangeZoom: (z: ZoomMode) => void;
  onTogglePixelated: () => void;
  onExportRecipe: () => void;
  onImportRecipe: (file: File) => void;
  onResetConfig: () => void;
  onNotify: (msg: string) => void;
}

const DOOR_TINT_SWATCHES = [
  { id: 'pure', labelZh: '纯黑白', labelEn: 'Pure B&W', black: '#000000', white: '#ffffff' },
  { id: 'amber', labelZh: '公寓琥珀', labelEn: 'Door Amber', black: '#140702', white: '#f9e9cc' },
  { id: 'cyan', labelZh: '公寓冷青', labelEn: 'Door Cyan', black: '#030f12', white: '#e0f8ff' },
  { id: 'sage', labelZh: '公寓苍绿', labelEn: 'Door Sage', black: '#060d04', white: '#e5f3d9' },
];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  lang,
  config,
  palettes,
  histogram,
  activeStage,
  zoom,
  pixelated,
  renderMs,
  onChangeConfig,
  onAddPalette,
  onUpdatePaletteColors,
  onSelectStage,
  onChangeZoom,
  onTogglePixelated,
  onExportRecipe,
  onImportRecipe,
  onResetConfig,
  onNotify,
}) => {
  const jsonRef = useRef<HTMLInputElement | null>(null);
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({
    canvas: false,
    desaturate: false,
    palettize: false,
    thresholds: false,
    colouring: true,
    noise: false,
    posterize: false,
  });

  const toggleCard = (id: string) =>
    setOpenCards((prev) => ({ ...prev, [id]: !prev[id] }));

  const randSeed = () => Math.floor(Math.random() * 99999);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Pro Utility Strip: Zoom Inspection & Recipe JSON */}
      <div className="control-group-card" style={{ gap: 10, padding: 12 }}>
        <div className="field-inline">
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {t(lang, '专业处理管线', 'Pro Pipeline')}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
            {renderMs.toFixed(1)} ms
          </span>
        </div>

        <div className="field-inline desktop-only" style={{ gap: 6 }}>
          <div className="seg-tabs" style={{ flex: 1 }}>
            {(['fit', 1, 2, 4] as ZoomMode[]).map((z) => (
              <button
                key={String(z)}
                type="button"
                className={`seg-tab ${zoom === z ? 'active' : ''}`}
                style={{ height: 30, fontSize: 12 }}
                onClick={() => onChangeZoom(z)}
              >
                {z === 'fit' ? t(lang, '适应', 'Fit') : `${z * 100}%`}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`btn btn-icon-sm ${pixelated ? 'btn-active' : 'btn-soft'}`}
            onClick={onTogglePixelated}
            aria-label={t(lang, '像素锐利显示', 'Crisp pixels')}
            title={t(lang, '放大时以锐利像素查看颗粒', 'Crisp nearest-neighbor pixel zoom')}
          >
            <Grid2x2 size={15} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm btn-soft" style={{ flex: 1 }} onClick={onExportRecipe}>
            <FileJson size={13} />
            <span>{t(lang, '导出配方', 'Export JSON')}</span>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-soft"
            style={{ flex: 1 }}
            onClick={() => jsonRef.current?.click()}
          >
            <FolderUp size={13} />
            <span>{t(lang, '导入配方', 'Import JSON')}</span>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-soft"
            onClick={onResetConfig}
            aria-label={t(lang, '重置所有参数', 'Reset all settings')}
          >
            <RotateCcw size={13} />
          </button>
        </div>

        <input
          ref={jsonRef}
          type="file"
          accept=".json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onImportRecipe(f);
          }}
        />
      </div>
        {/* 00. Canvas & Resize (Page 1) */}
        <StepCard
          stepNum="00"
          title={t(lang, '画布尺寸与裁切 · Resize', 'Canvas & Resize')}
          pdfPage="P.1"
          open={openCards.canvas}
          onToggleOpen={() => toggleCard('canvas')}
        >
          <div className="field-row">
            <span className="field-label">{t(lang, '输出分辨率', 'Resolution')}</span>
            <select
              value={config.canvas.resizeMode}
              onChange={(e) =>
                onChangeConfig((c) => ({
                  ...c,
                  canvas: { ...c.canvas, resizeMode: e.target.value as ResizeMode },
                }))
              }
            >
              <option value="zato_978x404">
                {t(lang, '宽屏 (978 × 404)', 'Widescreen (978 × 404)')}
              </option>
              <option value="width_978">
                {t(lang, '宽度 978px（保持原图比例）', 'Width 978px (Keep Aspect)')}
              </option>
              <option value="original">{t(lang, '保持原图尺寸', 'Original Dimensions')}</option>
              <option value="custom">{t(lang, '自定义尺寸...', 'Custom Size...')}</option>
            </select>
          </div>

          {config.canvas.resizeMode === 'custom' && (
            <div className="grid-2">
              <div className="field-row">
                <span className="field-label">{t(lang, '宽度 W', 'Width')}</span>
                <input
                  type="number"
                  min={64}
                  max={2560}
                  value={config.canvas.customWidth}
                  onChange={(e) =>
                    onChangeConfig((c) => ({
                      ...c,
                      canvas: {
                        ...c.canvas,
                        customWidth: Math.max(64, Math.min(2560, Number(e.target.value) || 978)),
                      },
                    }))
                  }
                />
              </div>
              <div className="field-row">
                <span className="field-label">{t(lang, '高度 H', 'Height')}</span>
                <input
                  type="number"
                  min={64}
                  max={2560}
                  value={config.canvas.customHeight}
                  onChange={(e) =>
                    onChangeConfig((c) => ({
                      ...c,
                      canvas: {
                        ...c.canvas,
                        customHeight: Math.max(64, Math.min(2560, Number(e.target.value) || 404)),
                      },
                    }))
                  }
                />
              </div>
            </div>
          )}

          {(config.canvas.resizeMode === 'zato_978x404' ||
            config.canvas.resizeMode === 'custom') && (
            <>
              <div className="field-row">
                <span className="field-label">{t(lang, '适配方式', 'Framing')}</span>
                <div className="seg-tabs">
                  {(
                    [
                      ['cover', t(lang, '裁切填充', 'Cover')],
                      ['contain', t(lang, '完整留黑', 'Contain')],
                      ['stretch', t(lang, '拉伸铺满', 'Stretch')],
                    ] as Array<[FitMode, string]>
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      className={`seg-tab ${config.canvas.fitMode === val ? 'active' : ''}`}
                      onClick={() =>
                        onChangeConfig((c) => ({
                          ...c,
                          canvas: { ...c.canvas, fitMode: val },
                        }))
                      }
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {config.canvas.fitMode === 'cover' && (
                <>
                  <SliderField
                    label={t(lang, '裁切缩放 Zoom', 'Crop Zoom')}
                    value={config.canvas.zoom}
                    min={1}
                    max={3}
                    step={0.05}
                    defaultValue={1}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    onChange={(v) =>
                      onChangeConfig((c) => ({ ...c, canvas: { ...c.canvas, zoom: v } }))
                    }
                  />
                  <div className="grid-2">
                    <SliderField
                      label={t(lang, '水平偏移 X', 'Pan X')}
                      value={config.canvas.panX}
                      min={-1}
                      max={1}
                      step={0.02}
                      defaultValue={0}
                      formatValue={(v) => `${Math.round(v * 100)}%`}
                      onChange={(v) =>
                        onChangeConfig((c) => ({ ...c, canvas: { ...c.canvas, panX: v } }))
                      }
                    />
                    <SliderField
                      label={t(lang, '垂直偏移 Y', 'Pan Y')}
                      value={config.canvas.panY}
                      min={-1}
                      max={1}
                      step={0.02}
                      defaultValue={0}
                      formatValue={(v) => `${Math.round(v * 100)}%`}
                      onChange={(v) =>
                        onChangeConfig((c) => ({ ...c, canvas: { ...c.canvas, panY: v } }))
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-soft"
                    onClick={() =>
                      onChangeConfig((c) => ({
                        ...c,
                        canvas: { ...c.canvas, panX: 0, panY: 0, zoom: 1 },
                      }))
                    }
                  >
                    <RotateCcw size={11} />
                    {t(lang, '重置构图位置', 'Reset Framing')}
                  </button>
                </>
              )}
            </>
          )}
        </StepCard>

        {/* 01. Desaturate (Page 1) */}
        <StepCard
          stepNum="01"
          title={t(lang, '去色 · Desaturate', 'Desaturate')}
          pdfPage="P.1"
          enabled={config.desaturate.enabled}
          onToggleEnabled={(en) =>
            onChangeConfig((c) => ({ ...c, desaturate: { ...c.desaturate, enabled: en } }))
          }
          open={openCards.desaturate}
          onToggleOpen={() => toggleCard('desaturate')}
        >
          <div className="field-row">
            <span className="field-label">{t(lang, '去色算法', 'Desaturate Mode')}</span>
            <select
              value={config.desaturate.mode}
              onChange={(e) =>
                onChangeConfig((c) => ({
                  ...c,
                  desaturate: { ...c.desaturate, mode: e.target.value as DesaturateMode },
                }))
              }
            >
              <option value="lightness">
                {t(lang, 'Lightness · 明度（默认）', 'Lightness (Default)')}
              </option>
              <option value="bt709">Luminosity (ITU-R BT.709)</option>
              <option value="bt601">Luminosity (ITU-R BT.601)</option>
              <option value="average">{t(lang, 'Average · 平均值', 'Average')}</option>
              <option value="min">{t(lang, 'Min · 最小值（更暗）', 'Min (Darker)')}</option>
              <option value="max">{t(lang, 'Max · 最大值（更亮）', 'Max (Brighter)')}</option>
            </select>
          </div>
        </StepCard>

        {/* 02. Base Palettize with Noise Dither (Page 2) */}
        <StepCard
          stepNum="02"
          title={t(lang, '调色板抖动 · Palettize', 'Base Palettize')}
          pdfPage="P.2"
          enabled={config.basePalettize.enabled}
          onToggleEnabled={(en) =>
            onChangeConfig((c) => ({
              ...c,
              basePalettize: { ...c.basePalettize, enabled: en },
            }))
          }
          open={openCards.palettize}
          onToggleOpen={() => toggleCard('palettize')}
        >
          <PaletteManager
            selectedPaletteId={config.basePalettize.paletteId}
            palettes={palettes}
            lang={lang}
            onSelectPalette={(id) =>
              onChangeConfig((c) => ({
                ...c,
                basePalettize: { ...c.basePalettize, paletteId: id },
              }))
            }
            onAddPalette={onAddPalette}
            onUpdatePaletteColors={onUpdatePaletteColors}
            onNotify={onNotify}
          />

          <div className="grid-2">
            <div className="field-row">
              <span className="field-label">{t(lang, '色彩空间', 'Color Space')}</span>
              <select
                value={config.basePalettize.colorSpace}
                onChange={(e) =>
                  onChangeConfig((c) => ({
                    ...c,
                    basePalettize: {
                      ...c.basePalettize,
                      colorSpace: e.target.value as PalettizeColorSpace,
                    },
                  }))
                }
              >
                <option value="lab">CIE Lab</option>
                <option value="rgb">sRGB</option>
              </select>
            </div>
            <div className="field-row">
              <span className="field-label">{t(lang, '抖动模式', 'Threshold Mode')}</span>
              <select
                value={config.basePalettize.thresholdMode}
                onChange={(e) =>
                  onChangeConfig((c) => ({
                    ...c,
                    basePalettize: {
                      ...c.basePalettize,
                      thresholdMode: e.target.value as DitherThresholdMode,
                    },
                  }))
                }
              >
                <option value="noise">{t(lang, 'Noise 噪点（推荐）', 'Noise (PDF)')}</option>
                <option value="bayer4">Pattern · Bayer 4×4</option>
                <option value="bayer8">Pattern · Bayer 8×8</option>
              </select>
            </div>
          </div>

          <div className="field-inline">
            <span className="field-label">{t(lang, '启用抖动 Dither', 'Enable Dither')}</span>
            <button
              type="button"
              className={`toggle ${config.basePalettize.dither ? 'on' : ''}`}
              onClick={() =>
                onChangeConfig((c) => ({
                  ...c,
                  basePalettize: { ...c.basePalettize, dither: !c.basePalettize.dither },
                }))
              }
            />
          </div>

          {config.basePalettize.dither && (
            <>
              <SliderField
                label={t(lang, '噪点偏移幅度 Offset Scale', 'Offset Scale')}
                value={config.basePalettize.offsetScale}
                min={0}
                max={0.5}
                step={0.005}
                defaultValue={0.125}
                formatValue={(v) => v.toFixed(3)}
                onChange={(v) =>
                  onChangeConfig((c) => ({
                    ...c,
                    basePalettize: { ...c.basePalettize, offsetScale: v },
                  }))
                }
              />
              <SliderField
                label={t(lang, '扩散强度 Spread', 'Spread')}
                value={config.basePalettize.spread}
                min={0}
                max={1}
                step={0.02}
                defaultValue={1.0}
                formatValue={(v) => v.toFixed(3)}
                onChange={(v) =>
                  onChangeConfig((c) => ({
                    ...c,
                    basePalettize: { ...c.basePalettize, spread: v },
                  }))
                }
              />
              <div className="grid-2">
                <div className="field-row">
                  <span className="field-label">{t(lang, '通道模式', 'Color Mode')}</span>
                  <select
                    value={config.basePalettize.colorMode}
                    onChange={(e) =>
                      onChangeConfig((c) => ({
                        ...c,
                        basePalettize: {
                          ...c.basePalettize,
                          colorMode: e.target.value as DitherColorMode,
                        },
                      }))
                    }
                  >
                    <option value="per_channel">Per Channel Offset</option>
                    <option value="luminance">Luminance Offset</option>
                  </select>
                </div>
                <div className="field-row">
                  <span className="field-label">{t(lang, '种子 Seed', 'Seed')}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input
                      type="number"
                      value={config.basePalettize.seed}
                      onChange={(e) =>
                        onChangeConfig((c) => ({
                          ...c,
                          basePalettize: {
                            ...c.basePalettize,
                            seed: Number(e.target.value) || 0,
                          },
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-icon-sm"
                      style={{ height: 28, width: 28 }}
                      onClick={() =>
                        onChangeConfig((c) => ({
                          ...c,
                          basePalettize: { ...c.basePalettize, seed: randSeed() },
                        }))
                      }
                    >
                      <Dices size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </StepCard>

        {/* 03. Solid Black (Darken) & Solid White (Lighten) Thresholds (Pages 3 & 4) */}
        <StepCard
          stepNum="03"
          title={t(lang, '黑白阈值层 · Darken / Lighten', 'B&W Thresholds')}
          pdfPage="P.3–4"
          open={openCards.thresholds}
          onToggleOpen={() => toggleCard('thresholds')}
        >
          {/* Solid Black (Darken) */}
          <div className="field-inline">
            <span style={{ fontSize: 12, fontWeight: 600 }}>
              {t(lang, '纯黑阴影层 (Darken)', 'Solid Black (Darken)')}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className={`btn btn-sm ${activeStage === 'blackMask' ? 'btn-active' : 'btn-soft'}`}
                onClick={() =>
                  onSelectStage(activeStage === 'blackMask' ? 'final' : 'blackMask')
                }
                title={t(lang, '查看纯黑阈值遮罩（对应教程 P3 上图）', 'Preview black threshold mask')}
              >
                <Eye size={11} />
                {t(lang, '遮罩', 'Mask')}
              </button>
              <button
                type="button"
                className={`toggle ${config.thresholds.blackEnabled ? 'on' : ''}`}
                onClick={() =>
                  onChangeConfig((c) => ({
                    ...c,
                    thresholds: { ...c.thresholds, blackEnabled: !c.thresholds.blackEnabled },
                  }))
                }
              />
            </div>
          </div>

          <SliderField
            label={t(lang, '暗部阈值（白多黑少）', 'Black Threshold')}
            value={config.thresholds.blackThreshold}
            min={0}
            max={255}
            defaultValue={66}
            disabled={!config.thresholds.blackEnabled}
            onChange={(v) =>
              onChangeConfig((c) => ({
                ...c,
                thresholds: { ...c.thresholds, blackThreshold: v },
              }))
            }
          />

          <div className="grid-2">
            <div className="field-row">
              <span className="field-label">{t(lang, '暗部替换色', 'Shadow Tint')}</span>
              <label className="color-chip-input">
                <input
                  type="color"
                  value={config.thresholds.blackColor}
                  onChange={(e) =>
                    onChangeConfig((c) => ({
                      ...c,
                      thresholds: { ...c.thresholds, blackColor: e.target.value },
                    }))
                  }
                />
                <span>{config.thresholds.blackColor.toUpperCase()}</span>
              </label>
            </div>
            <SliderField
              label={t(lang, '暗部不透明度', 'Opacity')}
              value={config.thresholds.blackOpacity}
              min={0}
              max={1}
              step={0.02}
              defaultValue={1}
              formatValue={(v) => `${Math.round(v * 100)}%`}
              disabled={!config.thresholds.blackEnabled}
              onChange={(v) =>
                onChangeConfig((c) => ({
                  ...c,
                  thresholds: { ...c.thresholds, blackOpacity: v },
                }))
              }
            />
          </div>

          <div className="divider" />

          {/* Solid White (Lighten) */}
          <div className="field-inline">
            <span style={{ fontSize: 12, fontWeight: 600 }}>
              {t(lang, '纯白高光层 (Lighten)', 'Solid White (Lighten)')}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className={`btn btn-sm ${activeStage === 'whiteMask' ? 'btn-active' : 'btn-soft'}`}
                onClick={() =>
                  onSelectStage(activeStage === 'whiteMask' ? 'final' : 'whiteMask')
                }
                title={t(lang, '查看纯白阈值遮罩（对应教程 P4 左图）', 'Preview white threshold mask')}
              >
                <Eye size={11} />
                {t(lang, '遮罩', 'Mask')}
              </button>
              <button
                type="button"
                className={`toggle ${config.thresholds.whiteEnabled ? 'on' : ''}`}
                onClick={() =>
                  onChangeConfig((c) => ({
                    ...c,
                    thresholds: { ...c.thresholds, whiteEnabled: !c.thresholds.whiteEnabled },
                  }))
                }
              />
            </div>
          </div>

          <SliderField
            label={t(lang, '高光阈值（黑多白少）', 'White Threshold')}
            value={config.thresholds.whiteThreshold}
            min={0}
            max={255}
            defaultValue={196}
            disabled={!config.thresholds.whiteEnabled}
            onChange={(v) =>
              onChangeConfig((c) => ({
                ...c,
                thresholds: { ...c.thresholds, whiteThreshold: v },
              }))
            }
          />

          <div className="grid-2">
            <div className="field-row">
              <span className="field-label">{t(lang, '高光替换色', 'Highlight Tint')}</span>
              <label className="color-chip-input">
                <input
                  type="color"
                  value={config.thresholds.whiteColor}
                  onChange={(e) =>
                    onChangeConfig((c) => ({
                      ...c,
                      thresholds: { ...c.thresholds, whiteColor: e.target.value },
                    }))
                  }
                />
                <span>{config.thresholds.whiteColor.toUpperCase()}</span>
              </label>
            </div>
            <SliderField
              label={t(lang, '高光不透明度', 'Opacity')}
              value={config.thresholds.whiteOpacity}
              min={0}
              max={1}
              step={0.02}
              defaultValue={1}
              formatValue={(v) => `${Math.round(v * 100)}%`}
              disabled={!config.thresholds.whiteEnabled}
              onChange={(v) =>
                onChangeConfig((c) => ({
                  ...c,
                  thresholds: { ...c.thresholds, whiteOpacity: v },
                }))
              }
            />
          </div>

          {/* Page 4 Side Note: Quick Apartment Door Tinted B&W Swatches */}
          <div className="field-row" style={{ gap: 5 }}>
            <span className="sub-note">
              {t(lang, '教程 P4 附注 · 快捷黑白染色（公寓门同款）：', 'PDF p.4 Note · Quick B&W Tints:')}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {DOOR_TINT_SWATCHES.map((sw) => (
                <button
                  key={sw.id}
                  type="button"
                  className="btn btn-sm"
                  style={{ gap: 5 }}
                  onClick={() =>
                    onChangeConfig((c) => ({
                      ...c,
                      thresholds: {
                        ...c.thresholds,
                        blackColor: sw.black,
                        whiteColor: sw.white,
                      },
                    }))
                  }
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      borderRadius: 2,
                      overflow: 'hidden',
                      border: '1px solid rgba(255,255,255,0.2)',
                    }}
                  >
                    <span style={{ width: 8, height: 10, background: sw.black }} />
                    <span style={{ width: 8, height: 10, background: sw.white }} />
                  </span>
                  <span>{lang === 'zh' ? sw.labelZh : sw.labelEn}</span>
                </button>
              ))}
            </div>
          </div>
        </StepCard>

        {/* 04. Colouring Modes + Tone Curves (Pages 5, 6, 8–12) */}
        <StepCard
          stepNum="04"
          title={t(lang, '风格上色与曲线 · Colouring', 'Colouring & Curves')}
          pdfPage="P.5–12"
          open={openCards.colouring}
          onToggleOpen={() => toggleCard('colouring')}
        >
          <div className="seg-tabs">
            {(
              [
                ['colourized', t(lang, 'HSV着色', 'HSV')],
                ['palettize', t(lang, '调色板', 'Palettize')],
                ['gradientMap', t(lang, '渐变映射', 'Grad Map')],
                ['gradientOverlay', t(lang, '颗粒叠层', 'Overlay')],
                ['none', t(lang, '无', 'None')],
              ] as Array<[ColouringMode, string]>
            ).map(([m, lbl]) => (
              <button
                key={m}
                type="button"
                className={`seg-tab ${config.colouring.mode === m ? 'active' : ''}`}
                onClick={() =>
                  onChangeConfig((c) => ({ ...c, colouring: { ...c.colouring, mode: m } }))
                }
              >
                {lbl}
              </button>
            ))}
          </div>

          {/* Mode A: HSV Colorize (Page 6) */}
          {config.colouring.mode === 'colourized' && (
            <>
              <SliderField
                label={t(lang, '色相 Hue', 'Hue')}
                className="hue-slider"
                value={config.colouring.hue}
                min={0}
                max={360}
                defaultValue={88}
                formatValue={(v) => `${v}°`}
                onChange={(v) =>
                  onChangeConfig((c) => ({ ...c, colouring: { ...c.colouring, hue: v } }))
                }
              />
              <SliderField
                label={t(lang, '饱和度 Saturation', 'Saturation')}
                value={config.colouring.saturation}
                min={0}
                max={100}
                defaultValue={24}
                formatValue={(v) => `${v}%`}
                onChange={(v) =>
                  onChangeConfig((c) => ({
                    ...c,
                    colouring: { ...c.colouring, saturation: v },
                  }))
                }
              />
              <SliderField
                label={t(lang, '明度偏移 Lightness', 'Lightness')}
                value={config.colouring.lightness}
                min={-40}
                max={40}
                defaultValue={0}
                formatValue={(v) => `${v > 0 ? '+' : ''}${v}%`}
                onChange={(v) =>
                  onChangeConfig((c) => ({
                    ...c,
                    colouring: { ...c.colouring, lightness: v },
                  }))
                }
              />
            </>
          )}

          {/* Mode B: Alternative Palettize Colorize (Pages 8–10) */}
          {config.colouring.mode === 'palettize' && (
            <>
              <div className="sub-note">
                {t(
                  lang,
                  '支持导入 .PAL / .GPL / .HEX 色板文件，或直接上传参考图提取索引色板。',
                  'Import .PAL / .GPL / .HEX palette files or extract an indexed palette from any reference image.',
                )}
              </div>
              <PaletteManager
                selectedPaletteId={config.colouring.colorPalettize.paletteId}
                palettes={palettes}
                lang={lang}
                onSelectPalette={(id) =>
                  onChangeConfig((c) => ({
                    ...c,
                    colouring: {
                      ...c.colouring,
                      colorPalettize: { ...c.colouring.colorPalettize, paletteId: id },
                    },
                  }))
                }
                onAddPalette={onAddPalette}
                onUpdatePaletteColors={onUpdatePaletteColors}
                onNotify={onNotify}
              />

              <div className="grid-2">
                <div className="field-row">
                  <span className="field-label">{t(lang, '色彩空间', 'Color Space')}</span>
                  <select
                    value={config.colouring.colorPalettize.colorSpace}
                    onChange={(e) =>
                      onChangeConfig((c) => ({
                        ...c,
                        colouring: {
                          ...c.colouring,
                          colorPalettize: {
                            ...c.colouring.colorPalettize,
                            colorSpace: e.target.value as PalettizeColorSpace,
                          },
                        },
                      }))
                    }
                  >
                    <option value="lab">CIE Lab</option>
                    <option value="rgb">sRGB</option>
                  </select>
                </div>
                <div className="field-row">
                  <span className="field-label">{t(lang, '抖动模式', 'Threshold')}</span>
                  <select
                    value={config.colouring.colorPalettize.thresholdMode}
                    onChange={(e) =>
                      onChangeConfig((c) => ({
                        ...c,
                        colouring: {
                          ...c.colouring,
                          colorPalettize: {
                            ...c.colouring.colorPalettize,
                            thresholdMode: e.target.value as DitherThresholdMode,
                          },
                        },
                      }))
                    }
                  >
                    <option value="noise">Noise (PDF)</option>
                    <option value="bayer4">Bayer 4×4</option>
                    <option value="bayer8">Bayer 8×8</option>
                  </select>
                </div>
              </div>

              <div className="field-inline">
                <span className="field-label">{t(lang, '开启噪点抖动 Dither', 'Enable Dither')}</span>
                <button
                  type="button"
                  className={`toggle ${config.colouring.colorPalettize.dither ? 'on' : ''}`}
                  onClick={() =>
                    onChangeConfig((c) => ({
                      ...c,
                      colouring: {
                        ...c.colouring,
                        colorPalettize: {
                          ...c.colouring.colorPalettize,
                          dither: !c.colouring.colorPalettize.dither,
                        },
                      },
                    }))
                  }
                />
              </div>

              {config.colouring.colorPalettize.dither && (
                <>
                  <SliderField
                    label="Offset Scale"
                    value={config.colouring.colorPalettize.offsetScale}
                    min={0}
                    max={0.5}
                    step={0.005}
                    defaultValue={0.125}
                    formatValue={(v) => v.toFixed(3)}
                    onChange={(v) =>
                      onChangeConfig((c) => ({
                        ...c,
                        colouring: {
                          ...c.colouring,
                          colorPalettize: { ...c.colouring.colorPalettize, offsetScale: v },
                        },
                      }))
                    }
                  />
                  <div className="field-inline">
                    <span className="field-label">{t(lang, '随机种子 Seed', 'Seed')}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        type="number"
                        style={{ width: 92 }}
                        value={config.colouring.colorPalettize.seed}
                        onChange={(e) =>
                          onChangeConfig((c) => ({
                            ...c,
                            colouring: {
                              ...c.colouring,
                              colorPalettize: {
                                ...c.colouring.colorPalettize,
                                seed: Number(e.target.value) || 0,
                              },
                            },
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="btn btn-icon-sm"
                        style={{ height: 28, width: 28 }}
                        onClick={() =>
                          onChangeConfig((c) => ({
                            ...c,
                            colouring: {
                              ...c.colouring,
                              colorPalettize: {
                                ...c.colouring.colorPalettize,
                                seed: randSeed(),
                              },
                            },
                          }))
                        }
                      >
                        <Dices size={12} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Mode C: Gradient Map (Pages 5 & 11) */}
          {config.colouring.mode === 'gradientMap' && (
            <>
              <GradientEditor
                stops={config.colouring.gradientMapStops}
                reverse={config.colouring.gradientMapReverse}
                presets={GRADIENT_MAP_PRESETS}
                lang={lang}
                onChangeStops={(stops) =>
                  onChangeConfig((c) => ({
                    ...c,
                    colouring: { ...c.colouring, gradientMapStops: stops },
                  }))
                }
                onToggleReverse={() =>
                  onChangeConfig((c) => ({
                    ...c,
                    colouring: {
                      ...c.colouring,
                      gradientMapReverse: !c.colouring.gradientMapReverse,
                    },
                  }))
                }
              />
              <div className="field-row">
                <span className="field-label">{t(lang, '渐变插值空间', 'Interpolation')}</span>
                <select
                  value={config.colouring.gradientMapSpace}
                  onChange={(e) =>
                    onChangeConfig((c) => ({
                      ...c,
                      colouring: {
                        ...c.colouring,
                        gradientMapSpace: e.target.value as GradientInterpSpace,
                      },
                    }))
                  }
                >
                  <option value="rgb">sRGB</option>
                  <option value="lab">CIE Lab (Perceptual)</option>
                </select>
              </div>
            </>
          )}

          {/* Mode D: Gradient Overlay + Grain Merge (Pages 5 & 12) */}
          {config.colouring.mode === 'gradientOverlay' && (
            <>
              <GradientEditor
                stops={config.colouring.overlayStops}
                reverse={config.colouring.overlayReverse}
                presets={OVERLAY_GRADIENT_PRESETS}
                lang={lang}
                onChangeStops={(stops) =>
                  onChangeConfig((c) => ({
                    ...c,
                    colouring: { ...c.colouring, overlayStops: stops },
                  }))
                }
                onToggleReverse={() =>
                  onChangeConfig((c) => ({
                    ...c,
                    colouring: {
                      ...c.colouring,
                      overlayReverse: !c.colouring.overlayReverse,
                    },
                  }))
                }
              />

              <div className="grid-2">
                <div className="field-row">
                  <span className="field-label">{t(lang, '混合模式', 'Blend Mode')}</span>
                  <select
                    value={config.colouring.overlayBlendMode}
                    onChange={(e) =>
                      onChangeConfig((c) => ({
                        ...c,
                        colouring: {
                          ...c.colouring,
                          overlayBlendMode: e.target.value as OverlayBlendMode,
                        },
                      }))
                    }
                  >
                    <option value="grainMerge">
                      {t(lang, 'Grain Merge 颗粒合并 (P12)', 'Grain Merge (PDF p.12)')}
                    </option>
                    <option value="overlay">Overlay 叠加</option>
                    <option value="softLight">Soft Light 柔光</option>
                    <option value="hardLight">Hard Light 强光</option>
                    <option value="multiply">Multiply 正片叠底</option>
                    <option value="color">Color 颜色</option>
                  </select>
                </div>
                <div className="field-row">
                  <span className="field-label">{t(lang, '渐变形状 Shape', 'Shape')}</span>
                  <select
                    value={config.colouring.overlayShape}
                    onChange={(e) =>
                      onChangeConfig((c) => ({
                        ...c,
                        colouring: {
                          ...c.colouring,
                          overlayShape: e.target.value as GradientShape,
                        },
                      }))
                    }
                  >
                    <option value="linear">Linear 线性</option>
                    <option value="bilinear">Bi-Linear 对称线性</option>
                    <option value="radial">Radial 径向</option>
                    <option value="square">Square 方形</option>
                    <option value="conical">Conical 锥形</option>
                  </select>
                </div>
              </div>

              <SliderField
                label={t(lang, '叠层不透明度 Opacity (推荐 60%)', 'Opacity (60% rec.)')}
                value={config.colouring.overlayOpacity}
                min={0}
                max={1}
                step={0.02}
                defaultValue={0.6}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) =>
                  onChangeConfig((c) => ({
                    ...c,
                    colouring: { ...c.colouring, overlayOpacity: v },
                  }))
                }
              />

              <div className="grid-2">
                <SliderField
                  label={t(lang, '角度 Angle', 'Angle')}
                  value={config.colouring.overlayAngle}
                  min={0}
                  max={360}
                  defaultValue={135}
                  formatValue={(v) => `${v}°`}
                  onChange={(v) =>
                    onChangeConfig((c) => ({
                      ...c,
                      colouring: { ...c.colouring, overlayAngle: v },
                    }))
                  }
                />
                <SliderField
                  label={t(lang, '范围 Scale', 'Scale')}
                  value={config.colouring.overlayScale}
                  min={0.25}
                  max={2.4}
                  step={0.05}
                  defaultValue={1.0}
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                  onChange={(v) =>
                    onChangeConfig((c) => ({
                      ...c,
                      colouring: { ...c.colouring, overlayScale: v },
                    }))
                  }
                />
              </div>

              <div className="grid-2">
                <SliderField
                  label={t(lang, '中心 X', 'Center X')}
                  value={config.colouring.overlayCenterX}
                  min={0}
                  max={1}
                  step={0.02}
                  defaultValue={0.5}
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                  onChange={(v) =>
                    onChangeConfig((c) => ({
                      ...c,
                      colouring: { ...c.colouring, overlayCenterX: v },
                    }))
                  }
                />
                <SliderField
                  label={t(lang, '中心 Y', 'Center Y')}
                  value={config.colouring.overlayCenterY}
                  min={0}
                  max={1}
                  step={0.02}
                  defaultValue={0.5}
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                  onChange={(v) =>
                    onChangeConfig((c) => ({
                      ...c,
                      colouring: { ...c.colouring, overlayCenterY: v },
                    }))
                  }
                />
              </div>
            </>
          )}

          <div className="divider" />

          {/* Color Adjustment Curves (Page 6) */}
          <div className="field-inline">
            <span className="field-label" style={{ fontWeight: 600, color: 'var(--ink)' }}>
              {t(lang, '反差曲线 · Color Adjustment Curves (P6)', 'Contrast Curves (P6)')}
            </span>
            <button
              type="button"
              className={`toggle ${config.colouring.curvesEnabled ? 'on' : ''}`}
              onClick={() =>
                onChangeConfig((c) => ({
                  ...c,
                  colouring: { ...c.colouring, curvesEnabled: !c.colouring.curvesEnabled },
                }))
              }
            />
          </div>

          {config.colouring.curvesEnabled && (
            <CurveEditor
              points={config.colouring.curvePoints}
              histogram={histogram}
              lang={lang}
              onChange={(pts) =>
                onChangeConfig((c) => ({
                  ...c,
                  colouring: { ...c.colouring, curvePoints: pts },
                }))
              }
            />
          )}
        </StepCard>

        {/* 05. Additive Noise */}
        <StepCard
          stepNum="05"
          title={t(lang, '叠加噪点 · Noise [Additive]', 'Additive Noise')}
          pdfPage="P.7"
          enabled={config.noise.enabled}
          onToggleEnabled={(en) =>
            onChangeConfig((c) => ({ ...c, noise: { ...c.noise, enabled: en } }))
          }
          open={openCards.noise}
          onToggleOpen={() => toggleCard('noise')}
        >
          <SliderField
            label={t(lang, '振幅 Amplitude（教程 7.6）', 'Amplitude (PDF: 7.6)')}
            value={config.noise.amplitude}
            min={0}
            max={50}
            step={0.2}
            defaultValue={7.6}
            formatValue={(v) => v.toFixed(1)}
            onChange={(v) =>
              onChangeConfig((c) => ({ ...c, noise: { ...c.noise, amplitude: v } }))
            }
          />

          <div className="grid-2">
            <div className="field-row">
              <span className="field-label">{t(lang, '噪点类型', 'Noise Type')}</span>
              <select
                value={config.noise.type}
                onChange={(e) =>
                  onChangeConfig((c) => ({
                    ...c,
                    noise: { ...c.noise, type: e.target.value as NoiseType },
                  }))
                }
              >
                <option value="gaussian">Gaussian 高斯（推荐）</option>
                <option value="uniform">Uniform 均匀</option>
                <option value="saltPepper">Salt &amp; Pepper 椒盐</option>
              </select>
            </div>
            <div className="field-row">
              <span className="field-label">{t(lang, '溢出处理', 'Value Action')}</span>
              <select
                value={config.noise.valueAction}
                onChange={(e) =>
                  onChangeConfig((c) => ({
                    ...c,
                    noise: { ...c.noise, valueAction: e.target.value as NoiseValueAction },
                  }))
                }
              >
                <option value="cut">Cut 截断 (Default)</option>
                <option value="normalize">Normalize 归一化</option>
                <option value="loop">Loop 环绕</option>
              </select>
            </div>
          </div>

          <div className="field-row">
            <span className="field-label">{t(lang, "作用通道 Channel(s)", 'Channel(s)')}</span>
            <select
              value={config.noise.channel}
              onChange={(e) =>
                onChangeConfig((c) => ({
                  ...c,
                  noise: { ...c.noise, channel: e.target.value as NoiseChannel },
                }))
              }
            >
              <option value="rgba_all">RGBA [All]（教程默认 · 微彩噪点）</option>
              <option value="ycbcr_y">YCbCr [Luminance]（纯亮度胶片颗粒）</option>
              <option value="ycbcr_cbcr">YCbCr [Blue-Red Chrominances]（纯色度噪点）</option>
              <option value="rgb_red">RGB [Red]</option>
              <option value="rgb_green">RGB [Green]</option>
              <option value="rgb_blue">RGB [Blue]</option>
              <option value="lab_l">Lab [Lightness]</option>
              <option value="lab_ab">Lab [ab-Chrominances]</option>
              <option value="hsv_h">HSV [Hue]</option>
              <option value="hsv_s">HSV [Saturation]</option>
              <option value="hsv_v">HSV [Value]</option>
            </select>
          </div>

          <div className="field-inline">
            <span className="field-label">{t(lang, '噪点种子 Seed', 'Noise Seed')}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="number"
                style={{ width: 96 }}
                value={config.noise.seed}
                onChange={(e) =>
                  onChangeConfig((c) => ({
                    ...c,
                    noise: { ...c.noise, seed: Number(e.target.value) || 0 },
                  }))
                }
              />
              <button
                type="button"
                className="btn btn-icon-sm"
                style={{ height: 28, width: 28 }}
                onClick={() =>
                  onChangeConfig((c) => ({
                    ...c,
                    noise: { ...c.noise, seed: randSeed() },
                  }))
                }
              >
                <Dices size={12} />
              </button>
            </div>
          </div>
        </StepCard>

        {/* 06. Posterize (Final Step, Page 8) */}
        <StepCard
          stepNum="06"
          title={t(lang, '色调分离 · Posterize', 'Posterize (Final)')}
          pdfPage="P.8"
          enabled={config.posterize.enabled}
          onToggleEnabled={(en) =>
            onChangeConfig((c) => ({ ...c, posterize: { ...c.posterize, enabled: en } }))
          }
          open={openCards.posterize}
          onToggleOpen={() => toggleCard('posterize')}
        >
          <SliderField
            label={t(lang, '色阶级数 Steps / Levels', 'Posterize Levels')}
            value={config.posterize.levels}
            min={2}
            max={48}
            step={1}
            defaultValue={10}
            formatValue={(v) => `${v} levels`}
            onChange={(v) =>
              onChangeConfig((c) => ({ ...c, posterize: { ...c.posterize, levels: v } }))
            }
          />
          <div className="sub-note">
            {t(
              lang,
              '提示：先加步骤 05 叠加噪点，再做色调分离，就能在色阶边缘自然产生 ZATO 标志性的像素颗粒过渡。',
              'Tip: Additive noise before posterize creates ZATO’s signature crisp stippled pixel transitions across tonal bands.',
            )}
          </div>
        </StepCard>
    </div>
  );
};
