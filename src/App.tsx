import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SlidersHorizontal, Sparkles, Upload } from 'lucide-react';
import type { Lang, NamedPalette, PipelineStageId, ZatoConfig, ZatoPreset } from './types';
import { renderDemoSceneCanvas, type DemoSceneMeta } from './engine/demoScenes';
import { getAllBuiltinPalettes } from './engine/palettes';
import { runZatoPipeline, type PixelBuffer } from './engine/pipeline';
import { createDefaultConfig, mergeConfig, ZATO_PRESETS } from './engine/presets';
import { generatePresetThumbnails } from './engine/thumbnails';
import { t } from './i18n';
import { BatchModal } from './components/BatchModal';
import { CanvasViewport, type ZoomMode } from './components/CanvasViewport';
import { InspectorPanel } from './components/InspectorPanel';
import { SimpleControls } from './components/SimpleControls';
import { TopBar } from './components/TopBar';

type SourceImageLike = HTMLImageElement | HTMLCanvasElement;
type DesktopPanelTab = 'simple' | 'pro';
type MobilePanelTab = 'presets' | 'adjust' | 'pro';

function computeTargetDimensions(
  srcW: number,
  srcH: number,
  canvasCfg: ZatoConfig['canvas'],
): { width: number; height: number } {
  switch (canvasCfg.resizeMode) {
    case 'zato_978x404':
      return { width: 978, height: 404 };
    case 'width_978': {
      const ratio = srcH / Math.max(1, srcW);
      return { width: 978, height: Math.max(1, Math.round(978 * ratio)) };
    }
    case 'original': {
      const maxDim = 2048;
      if (srcW <= maxDim && srcH <= maxDim) return { width: srcW, height: srcH };
      const scale = maxDim / Math.max(srcW, srcH);
      return {
        width: Math.max(1, Math.round(srcW * scale)),
        height: Math.max(1, Math.round(srcH * scale)),
      };
    }
    case 'custom':
      return {
        width: Math.max(64, Math.min(2560, Math.round(canvasCfg.customWidth))),
        height: Math.max(64, Math.min(2560, Math.round(canvasCfg.customHeight))),
      };
  }
}

function resampleSourceToBuffer(src: SourceImageLike, cfg: ZatoConfig): PixelBuffer {
  const srcW = src instanceof HTMLImageElement ? src.naturalWidth || src.width : src.width;
  const srcH = src instanceof HTMLImageElement ? src.naturalHeight || src.height : src.height;
  const { width: dstW, height: dstH } = computeTargetDimensions(srcW, srcH, cfg.canvas);

  const canvas = document.createElement('canvas');
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, dstW, dstH);

  const { fitMode, panX, panY, zoom } = cfg.canvas;

  if (
    fitMode === 'stretch' ||
    cfg.canvas.resizeMode === 'width_978' ||
    cfg.canvas.resizeMode === 'original'
  ) {
    ctx.drawImage(src, 0, 0, dstW, dstH);
  } else if (fitMode === 'contain') {
    const scale = Math.min(dstW / srcW, dstH / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const dx = (dstW - drawW) / 2;
    const dy = (dstH - drawH) / 2;
    ctx.drawImage(src, dx, dy, drawW, drawH);
  } else {
    const baseScale = Math.max(dstW / srcW, dstH / srcH);
    const effScale = baseScale * Math.max(1, zoom);
    const drawW = srcW * effScale;
    const drawH = srcH * effScale;
    const maxOffsetX = Math.max(0, (drawW - dstW) / 2);
    const maxOffsetY = Math.max(0, (drawH - dstH) / 2);
    const dx = (dstW - drawW) / 2 - panX * maxOffsetX;
    const dy = (dstH - drawH) / 2 - panY * maxOffsetY;
    ctx.drawImage(src, dx, dy, drawW, drawH);
  }

  const imgData = ctx.getImageData(0, 0, dstW, dstH);
  return { width: dstW, height: dstH, data: imgData.data };
}

export const App: React.FC = () => {
  const [lang, setLang] = useState<Lang>('zh');
  const [config, setConfig] = useState<ZatoConfig>(() => createDefaultConfig());
  const [palettes, setPalettes] = useState<NamedPalette[]>(() => getAllBuiltinPalettes());
  const [activePresetId, setActivePresetId] = useState<string | null>(ZATO_PRESETS[0].id);
  const [activeStage, setActiveStage] = useState<PipelineStageId>('final');

  const [desktopTab, setDesktopTab] = useState<DesktopPanelTab>('simple');
  const [mobileTab, setMobileTab] = useState<MobilePanelTab>('presets');
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth < 960 : false,
  );

  const [zoom, setZoom] = useState<ZoomMode>('fit');
  const [pixelated, setPixelated] = useState<boolean>(false);
  const [splitCompare, setSplitCompare] = useState<boolean>(false);
  const [batchOpen, setBatchOpen] = useState<boolean>(false);
  const [batchInitialFiles, setBatchInitialFiles] = useState<File[] | undefined>(undefined);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [activeDemoId, setActiveDemoId] = useState<DemoSceneMeta['id'] | null>('canopy');
  const [imageName, setImageName] = useState<string>('sunlit_canopy');
  const [sourceMedia, setSourceMedia] = useState<SourceImageLike>(() =>
    renderDemoSceneCanvas('canopy'),
  );

  const [outputBuffer, setOutputBuffer] = useState<PixelBuffer | null>(null);
  const [histogram, setHistogram] = useState<Uint32Array>(() => new Uint32Array(256));
  const [renderMs, setRenderMs] = useState<number>(0);
  const ambientCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isProMode = isMobile ? mobileTab === 'pro' : desktopTab === 'pro';

  // Generate live mini thumbnail previews of the active photo across all 10 ZATO presets
  const presetThumbs = useMemo(() => {
    return generatePresetThumbnails(sourceMedia, ZATO_PRESETS, palettes);
  }, [sourceMedia, palettes]);

  // Paint soft live optical ambient backdrop derived from the current processed artwork
  useEffect(() => {
    const canvas = ambientCanvasRef.current;
    if (!canvas || !outputBuffer) return;
    const aw = 96;
    const ah = 48;
    if (canvas.width !== aw || canvas.height !== ah) {
      canvas.width = aw;
      canvas.height = ah;
    }
    const tmp = document.createElement('canvas');
    tmp.width = outputBuffer.width;
    tmp.height = outputBuffer.height;
    const tCtx = tmp.getContext('2d')!;
    const imgData = tCtx.createImageData(outputBuffer.width, outputBuffer.height);
    imgData.data.set(outputBuffer.data);
    tCtx.putImageData(imgData, 0, 0);

    const aCtx = canvas.getContext('2d')!;
    aCtx.drawImage(tmp, 0, 0, aw, ah);
  }, [outputBuffer]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 960);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // When leaving Pro Mode, always return stage view to Final so users never get stuck on a mask
  useEffect(() => {
    if (!isProMode && activeStage !== 'final') {
      setActiveStage('final');
    }
    if (!isProMode && zoom !== 'fit') {
      setZoom('fit');
    }
  }, [isProMode, activeStage, zoom]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const resampledBuffer = useMemo(() => {
    return resampleSourceToBuffer(sourceMedia, config);
  }, [
    sourceMedia,
    config.canvas.resizeMode,
    config.canvas.customWidth,
    config.canvas.customHeight,
    config.canvas.fitMode,
    config.canvas.panX,
    config.canvas.panY,
    config.canvas.zoom,
  ]);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      const result = runZatoPipeline(resampledBuffer, config, palettes, activeStage);
      setOutputBuffer(result.buffer);
      setHistogram(result.histogram);
      setRenderMs(result.durationMs);
    });
    return () => cancelAnimationFrame(rafId);
  }, [resampledBuffer, config, palettes, activeStage]);

  const loadSingleImageFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        notify(t(lang, '请选择图片文件（PNG / JPG / WebP）', 'Please pick an image file'));
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        setActiveDemoId(null);
        setImageName(file.name.replace(/\.[^.]+$/, ''));
        setSourceMedia(img);
        setConfig((prev) => ({
          ...prev,
          canvas: { ...prev.canvas, panX: 0, panY: 0, zoom: 1 },
        }));
        notify(
          t(
            lang,
            `已载入照片：${file.name}`,
            `Loaded photo: ${file.name}`,
          ),
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        notify(t(lang, '图片读取失败，请换一张重试', 'Failed to load image'));
      };
      img.src = url;
    },
    [lang, notify],
  );

  // Smart handler: 1 image loads directly; 2+ images automatically open Batch Generator!
  const handleUploadFiles = useCallback(
    (files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length === 0) {
        notify(t(lang, '未检测到图片文件', 'No image files detected'));
        return;
      }
      if (imageFiles.length === 1) {
        loadSingleImageFile(imageFiles[0]);
      } else {
        loadSingleImageFile(imageFiles[0]);
        setBatchInitialFiles(imageFiles);
        setBatchOpen(true);
        notify(
          t(
            lang,
            `检测到 ${imageFiles.length} 张照片，已为你打开批量生成`,
            `Loaded ${imageFiles.length} photos into Batch Generator`,
          ),
        );
      }
    },
    [loadSingleImageFile, lang, notify],
  );

  const handleSelectDemo = useCallback((id: DemoSceneMeta['id']) => {
    setActiveDemoId(id);
    setImageName(`${id}_sample`);
    setSourceMedia(renderDemoSceneCanvas(id));
    setConfig((prev) => ({
      ...prev,
      canvas: { ...prev.canvas, panX: 0, panY: 0, zoom: 1 },
    }));
    const pairedPresetId =
      id === 'street'
        ? 'winter_streetlights'
        : id === 'palace'
          ? 'palace_violet'
          : 'forest_colourized';
    const preset = ZATO_PRESETS.find((p) => p.id === pairedPresetId);
    if (preset) {
      setConfig((prev) => mergeConfig(prev, preset.config));
      setActivePresetId(preset.id);
    }
  }, []);

  const handleSelectPreset = useCallback((preset: ZatoPreset) => {
    setActivePresetId(preset.id);
    setConfig((prev) => mergeConfig(prev, preset.config));
    setActiveStage('final');
  }, []);

  const handleChangeConfig = useCallback((updater: (prev: ZatoConfig) => ZatoConfig) => {
    setActivePresetId(null);
    setConfig(updater);
  }, []);

  const handleRandomizeSeeds = useCallback(() => {
    const s1 = Math.floor(Math.random() * 99999);
    const s2 = Math.floor(Math.random() * 99999);
    const s3 = Math.floor(Math.random() * 99999);
    setConfig((prev) => ({
      ...prev,
      basePalettize: { ...prev.basePalettize, seed: s1 },
      colouring: {
        ...prev.colouring,
        colorPalettize: { ...prev.colouring.colorPalettize, seed: s2 },
      },
      noise: { ...prev.noise, seed: s3 },
    }));
    notify(t(lang, '已刷新颗粒与噪点纹理', 'Shuffled grain & dither texture'));
  }, [lang, notify]);

  const handleToggleAspectQuick = useCallback(() => {
    setConfig((prev) => {
      const nextWide = prev.canvas.resizeMode !== 'zato_978x404';
      return {
        ...prev,
        canvas: {
          ...prev.canvas,
          resizeMode: nextWide ? 'zato_978x404' : 'width_978',
          fitMode: 'cover',
          panX: 0,
          panY: 0,
          zoom: 1,
        },
      };
    });
  }, []);

  const handleResetConfig = useCallback(() => {
    setConfig(createDefaultConfig());
    setActivePresetId(ZATO_PRESETS[0].id);
    setActiveStage('final');
    notify(t(lang, '已恢复默认效果', 'Reset to default look'));
  }, [lang, notify]);

  const renderFinalCanvas = useCallback((): HTMLCanvasElement => {
    const finalRes =
      activeStage === 'final' && outputBuffer
        ? outputBuffer
        : runZatoPipeline(resampledBuffer, config, palettes, 'final').buffer;
    const c = document.createElement('canvas');
    c.width = finalRes.width;
    c.height = finalRes.height;
    const ctx = c.getContext('2d')!;
    const imgData = ctx.createImageData(finalRes.width, finalRes.height);
    imgData.data.set(finalRes.data);
    ctx.putImageData(imgData, 0, 0);
    return c;
  }, [activeStage, outputBuffer, resampledBuffer, config, palettes]);

  const handleDownloadPng = useCallback(() => {
    const c = renderFinalCanvas();
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `${imageName}_zato_${c.width}x${c.height}.png`;
    a.click();
    notify(t(lang, `已保存图片 (${c.width}×${c.height})`, `Saved PNG (${c.width}×${c.height})`));
  }, [renderFinalCanvas, imageName, lang, notify]);

  const handleCopyPng = useCallback(async () => {
    try {
      const c = renderFinalCanvas();
      const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'));
      if (!blob || !navigator.clipboard?.write) {
        notify(t(lang, '当前浏览器不支持复制图片，请直接点「保存图片」', 'Clipboard unsupported — use Save'));
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      notify(t(lang, '已复制到剪贴板', 'Copied PNG to clipboard'));
    } catch {
      notify(t(lang, '复制失败，请直接点「保存图片」', 'Copy failed — try Save instead'));
    }
  }, [renderFinalCanvas, lang, notify]);

  const handleExportRecipe = useCallback(() => {
    const customPalettes = palettes.filter((p) => p.source !== 'builtin');
    const payload = JSON.stringify({ version: 1, config, customPalettes }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zato_recipe_${activePresetId ?? 'custom'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify(t(lang, '已导出配方 JSON', 'Exported recipe JSON'));
  }, [palettes, config, activePresetId, lang, notify]);

  const handleImportRecipe = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed?.config) throw new Error('Invalid recipe');
        if (Array.isArray(parsed.customPalettes) && parsed.customPalettes.length > 0) {
          setPalettes((prev) => {
            const ids = new Set(prev.map((p) => p.id));
            const extra = (parsed.customPalettes as NamedPalette[]).filter((p) => !ids.has(p.id));
            return [...prev, ...extra];
          });
        }
        setConfig(mergeConfig(createDefaultConfig(), parsed.config));
        setActivePresetId(null);
        notify(t(lang, `已导入配方：${file.name}`, `Loaded recipe: ${file.name}`));
      } catch {
        notify(t(lang, '配方文件格式无效', 'Invalid recipe JSON'));
      }
    },
    [lang, notify],
  );

  // Full-window drag-drop, clipboard paste & keyboard shortcuts
  useEffect(() => {
    let dragCounter = 0;
    const onDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        dragCounter++;
        setDragOver(true);
      }
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
      }
    };
    const onDragLeave = () => {
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) setDragOver(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setDragOver(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) handleUploadFiles(files);
    };
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((it) =>
        it.type.startsWith('image/'),
      );
      const file = item?.getAsFile();
      if (file) loadSingleImageFile(file);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleDownloadPng();
      } else if (e.key === '\\') {
        e.preventDefault();
        setSplitCompare((v) => !v);
      } else if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) {
        handleRandomizeSeeds();
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleUploadFiles, loadSingleImageFile, handleDownloadPng, handleRandomizeSeeds]);

  const canPanCrop =
    (config.canvas.resizeMode === 'zato_978x404' || config.canvas.resizeMode === 'custom') &&
    config.canvas.fitMode === 'cover';

  const openProMode = () => {
    setDesktopTab('pro');
    setMobileTab('pro');
  };

  return (
    <>
      <div className="ambient-layer" aria-hidden="true">
        <canvas ref={ambientCanvasRef} className="ambient-canvas" />
        <div className="ambient-veil" />
      </div>

      <div className="app-shell">
        <TopBar
        lang={lang}
        onToggleLang={() => setLang((l) => (l === 'zh' ? 'en' : 'zh'))}
        onUploadFiles={handleUploadFiles}
        onOpenBatch={() => {
          setBatchInitialFiles(undefined);
          setBatchOpen(true);
        }}
        onDownloadPng={handleDownloadPng}
      />

      <main className="workspace-body">
        <CanvasViewport
          lang={lang}
          isProMode={isProMode}
          activeDemoId={activeDemoId}
          activeStage={activeStage}
          resizeMode={config.canvas.resizeMode}
          outputBuffer={outputBuffer}
          originalBuffer={resampledBuffer}
          zoom={zoom}
          pixelated={pixelated}
          splitCompare={splitCompare}
          canPanCrop={canPanCrop}
          onUploadFiles={handleUploadFiles}
          onSelectDemo={handleSelectDemo}
          onSelectStage={setActiveStage}
          onToggleSplit={() => setSplitCompare((s) => !s)}
          onRandomizeSeeds={handleRandomizeSeeds}
          onToggleAspectQuick={handleToggleAspectQuick}
          onPanDelta={(dx, dy) =>
            setConfig((prev) => ({
              ...prev,
              canvas: {
                ...prev.canvas,
                panX: Math.max(-1, Math.min(1, prev.canvas.panX + dx)),
                panY: Math.max(-1, Math.min(1, prev.canvas.panY + dy)),
              },
            }))
          }
        />

        <aside className="control-panel" aria-label={t(lang, '控制面板', 'Controls')}>
          <div className="mobile-grabber" aria-hidden="true" />
          {/* Mode Switcher Bar: 2 tabs on Desktop, 3 tabs on Mobile */}
          <div className="panel-mode-bar">
            {isMobile ? (
              <div className="seg-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mobileTab === 'presets'}
                  className={`seg-tab ${mobileTab === 'presets' ? 'active' : ''}`}
                  onClick={() => setMobileTab('presets')}
                >
                  <Sparkles size={14} />
                  <span>{t(lang, '风格', 'Styles')}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mobileTab === 'adjust'}
                  className={`seg-tab ${mobileTab === 'adjust' ? 'active' : ''}`}
                  onClick={() => setMobileTab('adjust')}
                >
                  <span>{t(lang, '微调', 'Adjust')}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mobileTab === 'pro'}
                  className={`seg-tab ${mobileTab === 'pro' ? 'active' : ''}`}
                  onClick={() => setMobileTab('pro')}
                >
                  <SlidersHorizontal size={14} />
                  <span>{t(lang, '专业', 'Pro')}</span>
                </button>
              </div>
            ) : (
              <div className="seg-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={desktopTab === 'simple'}
                  className={`seg-tab ${desktopTab === 'simple' ? 'active' : ''}`}
                  onClick={() => setDesktopTab('simple')}
                >
                  <Sparkles size={14} />
                  <span>{t(lang, '快速调整', 'Simple')}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={desktopTab === 'pro'}
                  className={`seg-tab ${desktopTab === 'pro' ? 'active' : ''}`}
                  onClick={() => setDesktopTab('pro')}
                >
                  <SlidersHorizontal size={14} />
                  <span>{t(lang, '专业模式', 'Pro Mode')}</span>
                </button>
              </div>
            )}
          </div>

          <div className="panel-scroll">
            {isProMode ? (
              <InspectorPanel
                lang={lang}
                config={config}
                palettes={palettes}
                histogram={histogram}
                activeStage={activeStage}
                zoom={zoom}
                pixelated={pixelated}
                renderMs={renderMs}
                onChangeConfig={handleChangeConfig}
                onAddPalette={(p) => setPalettes((prev) => [...prev, p])}
                onUpdatePaletteColors={(id, colors) =>
                  setPalettes((prev) => prev.map((p) => (p.id === id ? { ...p, colors } : p)))
                }
                onSelectStage={setActiveStage}
                onChangeZoom={setZoom}
                onTogglePixelated={() => setPixelated((p) => !p)}
                onExportRecipe={handleExportRecipe}
                onImportRecipe={handleImportRecipe}
                onResetConfig={handleResetConfig}
                onNotify={notify}
              />
            ) : (
              <SimpleControls
                lang={lang}
                section={isMobile ? (mobileTab === 'presets' ? 'presets' : 'adjust') : 'all'}
                config={config}
                presets={ZATO_PRESETS}
                presetThumbs={presetThumbs}
                palettes={palettes}
                activePresetId={activePresetId}
                activeDemoId={activeDemoId}
                onSelectPreset={handleSelectPreset}
                onSelectDemo={handleSelectDemo}
                onUploadFiles={handleUploadFiles}
                onChangeConfig={handleChangeConfig}
                onOpenProMode={openProMode}
                onCopyPng={handleCopyPng}
                onOpenBatch={() => {
                  setBatchInitialFiles(undefined);
                  setBatchOpen(true);
                }}
                onResetConfig={handleResetConfig}
              />
            )}
          </div>
        </aside>
      </main>

      {batchOpen && (
        <BatchModal
          lang={lang}
          initialFiles={batchInitialFiles}
          config={config}
          palettes={palettes}
          renderResampled={(img, cfg) => resampleSourceToBuffer(img, cfg)}
          onClose={() => {
            setBatchOpen(false);
            setBatchInitialFiles(undefined);
          }}
          onNotify={notify}
        />
      )}

      {dragOver && (
        <div className="drop-overlay">
          <div className="drop-overlay-box">
            <Upload size={34} color="var(--accent)" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
              {t(lang, '松开鼠标，立即导入照片', 'Drop photo(s) to load')}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>
              {t(
                lang,
                '拖入 1 张直接编辑 · 拖入多张将自动开启批量生成',
                '1 photo opens immediately · Multiple photos open Batch Generator',
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
      </div>
    </>
  );
};
