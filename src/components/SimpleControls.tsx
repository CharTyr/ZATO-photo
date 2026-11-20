import React, { useRef } from 'react';
import {
  Check,
  ChevronRight,
  ClipboardCopy,
  Layers,
  RotateCcw,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import type { Lang, NamedPalette, ZatoConfig, ZatoPreset } from '../types';
import { DEMO_SCENES, type DemoSceneMeta } from '../engine/demoScenes';
import { stopsToCssLinearGradient } from '../engine/gradients';
import { t } from '../i18n';
import { SliderField } from './ui/SliderField';

interface FriendlyPresetMeta {
  titleZh: string;
  titleEn: string;
  tagZh: string;
  tagEn: string;
}

const FRIENDLY_PRESET_LABELS: Record<string, FriendlyPresetMeta> = {
  forest_colourized: {
    titleZh: '林荫胶片绿',
    titleEn: 'Forest Olive',
    tagZh: '经典复古主色调',
    tagEn: 'Classic olive',
  },
  palace_violet: {
    titleZh: '文化宫紫灰',
    titleEn: 'Palace Mauve',
    tagZh: '冷峻建筑氛围',
    tagEn: 'Brutalist mauve',
  },
  winter_streetlights: {
    titleZh: '冬夜路灯蓝',
    titleEn: 'Winter Lamps',
    tagZh: '冷冽雪夜光晕',
    tagEn: 'Cold night blue',
  },
  mosaic_grain_merge: {
    titleZh: '壁画暗红',
    titleEn: 'Mosaic Rose',
    tagZh: '深沉胶片暗角',
    tagEn: 'Deep crimson glow',
  },
  canopy_violet_overlay: {
    titleZh: '林冠紫雾',
    titleEn: 'Dusk Violet',
    tagZh: '柔和颗粒渐层',
    tagEn: 'Soft grain wash',
  },
  electric_cyan_map: {
    titleZh: '电光冷青',
    titleEn: 'Electric Cyan',
    tagZh: '强反差冷调',
    tagEn: 'High-contrast cyan',
  },
  palettize_moss: {
    titleZh: '苔绿点阵',
    titleEn: 'Moss Indexed',
    tagZh: '像素调色板抖动',
    tagEn: 'Indexed dither',
  },
  door_amber: {
    titleZh: '暖琥珀光',
    titleEn: 'Warm Amber',
    tagZh: '暖棕与米白高光',
    tagEn: 'Amber & cream',
  },
  door_cyan: {
    titleZh: '走廊冰青',
    titleEn: 'Hallway Cyan',
    tagZh: '暗青黑与冷白',
    tagEn: 'Teal & ice',
  },
  door_sage: {
    titleZh: '苍绿雾影',
    titleEn: 'Pale Sage',
    tagZh: '墨绿黑与浅青白',
    tagEn: 'Olive & sage',
  },
};

const DEMO_SHORT_NAMES: Record<DemoSceneMeta['id'], { zh: string; en: string }> = {
  canopy: { zh: '林荫', en: 'Canopy' },
  street: { zh: '雪夜', en: 'Street' },
  palace: { zh: '文化宫', en: 'Palace' },
};

interface SimpleControlsProps {
  lang: Lang;
  section: 'all' | 'presets' | 'adjust';
  config: ZatoConfig;
  presets: ZatoPreset[];
  presetThumbs: Record<string, string>;
  palettes: NamedPalette[];
  activePresetId: string | null;
  activeDemoId: DemoSceneMeta['id'] | null;
  onSelectPreset: (preset: ZatoPreset) => void;
  onSelectDemo: (id: DemoSceneMeta['id']) => void;
  onUploadFiles: (files: File[]) => void;
  onChangeConfig: (updater: (prev: ZatoConfig) => ZatoConfig) => void;
  onOpenProMode: () => void;
  onCopyPng: () => void;
  onOpenBatch: () => void;
  onResetConfig: () => void;
}

export const SimpleControls: React.FC<SimpleControlsProps> = ({
  lang,
  section,
  config,
  presets,
  presetThumbs,
  palettes,
  activePresetId,
  activeDemoId,
  onSelectPreset,
  onSelectDemo,
  onUploadFiles,
  onChangeConfig,
  onOpenProMode,
  onCopyPng,
  onOpenBatch,
  onResetConfig,
}) => {
  const mobileFileRef = useRef<HTMLInputElement | null>(null);
  const showPresets = section === 'all' || section === 'presets';
  const showAdjust = section === 'all' || section === 'adjust';

  const activeColorPalette = palettes.find(
    (p) => p.id === config.colouring.colorPalettize.paletteId,
  );

  const isWide978 = config.canvas.resizeMode === 'zato_978x404';

  return (
    <>
      {/* Mobile-only quick photo upload + sample picker */}
      {showPresets && (
        <div className="section-block mobile-only" style={{ flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            className="drop-bar-trigger"
            style={{ width: '100%', justifyContent: 'center', height: 44 }}
            onClick={() => mobileFileRef.current?.click()}
          >
            <Upload size={16} />
            <span>{t(lang, '从相册选择照片（支持多选批量）', 'Choose photo(s) from device')}</span>
          </button>

          <div className="sample-strip" style={{ justifyContent: 'space-between' }}>
            <span className="sample-label">{t(lang, '或试试示例：', 'Try sample:')}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {DEMO_SCENES.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  className={`sample-btn ${activeDemoId === sc.id ? 'active' : ''}`}
                  onClick={() => onSelectDemo(sc.id)}
                >
                  {lang === 'zh' ? DEMO_SHORT_NAMES[sc.id].zh : DEMO_SHORT_NAMES[sc.id].en}
                </button>
              ))}
            </div>
          </div>

          <input
            ref={mobileFileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (files.length > 0) onUploadFiles(files);
            }}
          />
        </div>
      )}

      {/* Style Presets Grid */}
      {showPresets && (
        <div className="section-block">
          <div className="section-head">
            <span className="section-title">{t(lang, '挑选风格', 'Choose a Style')}</span>
            <span className="section-sub">{t(lang, '点击一键套用', 'One-tap looks')}</span>
          </div>

          <div className="preset-grid">
            {presets.map((preset) => {
              const meta = FRIENDLY_PRESET_LABELS[preset.id];
              const title = meta
                ? lang === 'zh'
                  ? meta.titleZh
                  : meta.titleEn
                : lang === 'zh'
                  ? preset.nameZh
                  : preset.name;
              const tag = meta
                ? lang === 'zh'
                  ? meta.tagZh
                  : meta.tagEn
                : preset.pdfRef;

              const thumbUrl = presetThumbs[preset.id];
              const isActive = activePresetId === preset.id;

              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`preset-card ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectPreset(preset)}
                >
                  {isActive && (
                    <span className="preset-active-dot" aria-hidden="true">
                      <Check size={11} strokeWidth={3} />
                    </span>
                  )}
                  <div className="preset-thumb-wrap" aria-hidden="true">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt="" className="preset-thumb-img" />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: `linear-gradient(120deg, ${preset.swatch[0]}, ${preset.swatch[1]}, ${preset.swatch[2]})`,
                        }}
                      />
                    )}
                  </div>
                  <div className="preset-card-meta">
                    <div className="preset-card-name">{title}</div>
                    <div className="preset-card-tag">{tag}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Everyday Simple Adjustments */}
      {showAdjust && (
        <div className="section-block">
          <div className="section-head">
            <span className="section-title">{t(lang, '画面微调', 'Quick Adjustments')}</span>
            <button
              type="button"
              className="btn btn-sm btn-soft"
              onClick={onResetConfig}
            >
              <RotateCcw size={13} />
              <span>{t(lang, '重置', 'Reset')}</span>
            </button>
          </div>

          <div className="control-group-card">
            {/* Context-smart Color control */}
            {config.colouring.mode === 'colourized' ? (
              <>
                <SliderField
                  label={t(lang, '色调颜色', 'Tint Color')}
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
                  label={t(lang, '色彩浓度', 'Color Intensity')}
                  value={config.colouring.saturation}
                  min={0}
                  max={85}
                  defaultValue={24}
                  formatValue={(v) => `${v}%`}
                  onChange={(v) =>
                    onChangeConfig((c) => ({
                      ...c,
                      colouring: { ...c.colouring, saturation: v },
                    }))
                  }
                />
              </>
            ) : config.colouring.mode === 'gradientOverlay' ? (
              <SliderField
                label={t(lang, '渐变叠加浓度', 'Tint Overlay Strength')}
                value={Math.round(config.colouring.overlayOpacity * 100)}
                min={0}
                max={100}
                defaultValue={60}
                formatValue={(v) => `${v}%`}
                onChange={(v) =>
                  onChangeConfig((c) => ({
                    ...c,
                    colouring: { ...c.colouring, overlayOpacity: v / 100 },
                  }))
                }
              />
            ) : config.colouring.mode === 'gradientMap' ? (
              <div className="field-row">
                <div className="field-inline">
                  <span className="field-label">{t(lang, '当前渐变配色', 'Active Gradient')}</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-soft"
                    onClick={onOpenProMode}
                  >
                    {t(lang, '改配色', 'Edit')}
                  </button>
                </div>
                <div
                  style={{
                    height: 20,
                    borderRadius: 99,
                    border: '1px solid rgba(255,255,255,0.28)',
                    background: stopsToCssLinearGradient(
                      config.colouring.gradientMapStops,
                      config.colouring.gradientMapReverse,
                    ),
                  }}
                />
              </div>
            ) : config.colouring.mode === 'palettize' && activeColorPalette ? (
              <div className="field-row">
                <div className="field-inline">
                  <span className="field-label">{t(lang, '当前索引色板', 'Active Palette')}</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-soft"
                    onClick={onOpenProMode}
                  >
                    {t(lang, '换色板', 'Change')}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {activeColorPalette.colors.slice(0, 14).map((hex, idx) => (
                    <span
                      key={`${hex}-${idx}`}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 5,
                        background: hex,
                        border: '1px solid rgba(255,255,255,0.24)',
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {config.colouring.mode !== 'none' && <div className="divider" />}

            <SliderField
              label={t(lang, '暗部深度', 'Shadow Depth')}
              value={
                config.thresholds.blackEnabled
                  ? Math.min(160, Math.max(0, config.thresholds.blackThreshold))
                  : 0
              }
              min={0}
              max={160}
              defaultValue={66}
              formatValue={(v) => `${Math.round((v / 160) * 100)}%`}
              onChange={(v) =>
                onChangeConfig((c) => ({
                  ...c,
                  thresholds: { ...c.thresholds, blackEnabled: v > 0, blackThreshold: v },
                }))
              }
            />

            <SliderField
              label={t(lang, '高光留白', 'Highlight Blowout')}
              value={
                config.thresholds.whiteEnabled
                  ? Math.min(160, Math.max(0, 255 - config.thresholds.whiteThreshold))
                  : 0
              }
              min={0}
              max={160}
              defaultValue={255 - 196}
              formatValue={(v) => `${Math.round((v / 160) * 100)}%`}
              onChange={(v) =>
                onChangeConfig((c) => ({
                  ...c,
                  thresholds: {
                    ...c.thresholds,
                    whiteEnabled: v > 0,
                    whiteThreshold: 255 - v,
                  },
                }))
              }
            />

            <SliderField
              label={t(lang, '胶片颗粒', 'Film Grain')}
              value={config.noise.enabled ? Math.min(28, Math.max(0, config.noise.amplitude)) : 0}
              min={0}
              max={28}
              step={0.4}
              defaultValue={7.6}
              formatValue={(v) => (v <= 0 ? t(lang, '关', 'Off') : `${Math.round((v / 28) * 100)}%`)}
              onChange={(v) =>
                onChangeConfig((c) => ({
                  ...c,
                  noise: { ...c.noise, enabled: v > 0, amplitude: v },
                }))
              }
            />

            <SliderField
              label={t(lang, '复古色阶', 'Retro Banding')}
              value={
                config.posterize.enabled
                  ? Math.min(32, Math.max(3, config.posterize.levels))
                  : 32
              }
              min={3}
              max={32}
              step={1}
              defaultValue={10}
              formatValue={(v) => (v >= 32 ? t(lang, '柔和', 'Smooth') : `${v} 阶`)}
              onChange={(v) =>
                onChangeConfig((c) => ({
                  ...c,
                  posterize: { ...c.posterize, enabled: v < 32, levels: v },
                }))
              }
            />
          </div>

          {/* Framing Quick Toggle */}
          <div className="control-group-card">
            <div className="field-row">
              <span className="field-label">{t(lang, '输出画幅', 'Output Aspect')}</span>
              <div className="seg-tabs">
                <button
                  type="button"
                  className={`seg-tab ${isWide978 ? 'active' : ''}`}
                  onClick={() =>
                    onChangeConfig((c) => ({
                      ...c,
                      canvas: { ...c.canvas, resizeMode: 'zato_978x404', fitMode: 'cover' },
                    }))
                  }
                >
                  {t(lang, '宽屏', 'Widescreen')}
                </button>
                <button
                  type="button"
                  className={`seg-tab ${!isWide978 ? 'active' : ''}`}
                  onClick={() =>
                    onChangeConfig((c) => ({
                      ...c,
                      canvas: { ...c.canvas, resizeMode: 'width_978' },
                    }))
                  }
                >
                  {t(lang, '保持原图比例', 'Keep Aspect')}
                </button>
              </div>
            </div>

            {isWide978 && (
              <SliderField
                label={t(lang, '构图缩放（画布可拖动裁切）', 'Crop Zoom (drag photo to pan)')}
                value={config.canvas.zoom}
                min={1}
                max={2.5}
                step={0.05}
                defaultValue={1}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) =>
                  onChangeConfig((c) => ({
                    ...c,
                    canvas: { ...c.canvas, fitMode: 'cover', zoom: v },
                  }))
                }
              />
            )}
          </div>

          {/* Handy Secondary Utilities */}
          <div className="grid-2">
            <button type="button" className="btn" onClick={onCopyPng}>
              <ClipboardCopy size={15} />
              <span>{t(lang, '复制图片', 'Copy Image')}</span>
            </button>
            <button type="button" className="btn" onClick={onOpenBatch}>
              <Layers size={15} />
              <span>{t(lang, '批量处理', 'Batch')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Calm Invitation to Pro Mode */}
      <button type="button" className="pro-callout" onClick={onOpenProMode}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SlidersHorizontal size={18} color="var(--accent)" />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
              {t(lang, '打开专业模式', 'Open Pro Mode')}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
              {t(
                lang,
                '色调曲线、自定义色板、参考图取色、混合叠加与分步预览',
                'Curves, custom palettes, image color extraction & stage preview',
              )}
            </div>
          </div>
        </div>
        <ChevronRight size={17} color="var(--muted)" />
      </button>
    </>
  );
};
