import React, { useEffect, useRef, useState } from 'react';
import { Columns2, Dices, Maximize2, Upload } from 'lucide-react';
import type { Lang, PipelineStageId, ResizeMode } from '../types';
import { DEMO_SCENES, type DemoSceneMeta } from '../engine/demoScenes';
import { STAGE_LABELS, t } from '../i18n';
import type { PixelBuffer } from '../engine/pipeline';

export type ZoomMode = 'fit' | 1 | 2 | 4;

const STAGE_ORDER: PipelineStageId[] = [
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
];

const DEMO_SHORT_NAMES: Record<DemoSceneMeta['id'], { zh: string; en: string }> = {
  canopy: { zh: '林荫', en: 'Canopy' },
  street: { zh: '雪夜', en: 'Street' },
  palace: { zh: '文化宫', en: 'Palace' },
};

interface CanvasViewportProps {
  lang: Lang;
  isProMode: boolean;
  activeDemoId: DemoSceneMeta['id'] | null;
  activeStage: PipelineStageId;
  resizeMode: ResizeMode;
  outputBuffer: PixelBuffer | null;
  originalBuffer: PixelBuffer | null;
  zoom: ZoomMode;
  pixelated: boolean;
  splitCompare: boolean;
  canPanCrop: boolean;
  onUploadFiles: (files: File[]) => void;
  onSelectDemo: (id: DemoSceneMeta['id']) => void;
  onSelectStage: (stage: PipelineStageId) => void;
  onToggleSplit: () => void;
  onRandomizeSeeds: () => void;
  onToggleAspectQuick: () => void;
  onPanDelta: (dxNorm: number, dyNorm: number) => void;
}

export const CanvasViewport: React.FC<CanvasViewportProps> = ({
  lang,
  isProMode,
  activeDemoId,
  activeStage,
  resizeMode,
  outputBuffer,
  originalBuffer,
  zoom,
  pixelated,
  splitCompare,
  canPanCrop,
  onUploadFiles,
  onSelectDemo,
  onSelectStage,
  onToggleSplit,
  onRandomizeSeeds,
  onToggleAspectQuick,
  onPanDelta,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const outCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const origCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dropInputRef = useRef<HTMLInputElement | null>(null);

  const [viewportSize, setViewportSize] = useState({ w: 800, h: 460 });
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth < 960 : false,
  );
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [draggingSplit, setDraggingSplit] = useState(false);
  const [panning, setPanning] = useState(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 960);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setViewportSize({ w: rect.width, h: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = outCanvasRef.current;
    if (!canvas || !outputBuffer) return;
    if (canvas.width !== outputBuffer.width || canvas.height !== outputBuffer.height) {
      canvas.width = outputBuffer.width;
      canvas.height = outputBuffer.height;
    }
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(outputBuffer.width, outputBuffer.height);
    imgData.data.set(outputBuffer.data);
    ctx.putImageData(imgData, 0, 0);
  }, [outputBuffer]);

  useEffect(() => {
    const canvas = origCanvasRef.current;
    if (!canvas || !originalBuffer || !splitCompare) return;
    if (canvas.width !== originalBuffer.width || canvas.height !== originalBuffer.height) {
      canvas.width = originalBuffer.width;
      canvas.height = originalBuffer.height;
    }
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(originalBuffer.width, originalBuffer.height);
    imgData.data.set(originalBuffer.data);
    ctx.putImageData(imgData, 0, 0);
  }, [originalBuffer, splitCompare]);

  const imgW = outputBuffer?.width ?? 978;
  const imgH = outputBuffer?.height ?? 404;

  let displayScale = 1;
  if (isMobile) {
    const availW = Math.max(240, viewportSize.w - 24);
    const maxMobileH = Math.max(168, Math.min(260, Math.round(window.innerHeight * 0.32)));
    displayScale = Math.min(availW / imgW, maxMobileH / imgH);
  } else if (zoom === 'fit') {
    const padW = Math.max(200, viewportSize.w - 48);
    const padH = Math.max(180, viewportSize.h - 86);
    displayScale = Math.min(padW / imgW, padH / imgH, 1.35);
  } else {
    displayScale = zoom;
  }

  const dispW = Math.max(1, Math.round(imgW * displayScale));
  const dispH = Math.max(1, Math.round(imgH * displayScale));

  const updateSplitFromClientX = (clientX: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ratio = Math.max(0.04, Math.min(0.96, (clientX - rect.left) / rect.width));
    setSplitRatio(ratio);
  };

  const handleFramePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingSplit || !canPanCrop) return;
    setPanning(true);
    lastPointer.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleFramePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingSplit) {
      updateSplitFromClientX(e.clientX);
      return;
    }
    if (!panning) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    onPanDelta((-dx / dispW) * 1.6, (-dy / dispH) * 1.6);
  };

  const handleFramePointerUp = () => {
    setPanning(false);
    setDraggingSplit(false);
  };

  const isWideStandard = resizeMode === 'zato_978x404';

  return (
    <section className="stage-column" aria-label={t(lang, '预览画布', 'Preview Stage')}>
      <div
        ref={stageRef}
        className="stage-canvas-area"
        style={{ overflow: !isMobile && zoom !== 'fit' ? 'auto' : 'hidden' }}
      >
        {/* Main Photo Frame */}
        <div className="photo-frame-wrap">
          <div
            ref={frameRef}
            className={`canvas-frame ${pixelated || (!isMobile && displayScale >= 2) ? 'pixelated' : ''}`}
            style={{
              width: dispW,
              height: dispH,
              cursor: canPanCrop ? (panning ? 'grabbing' : 'grab') : 'default',
            }}
            onPointerDown={handleFramePointerDown}
            onPointerMove={handleFramePointerMove}
            onPointerUp={handleFramePointerUp}
          >
            <canvas ref={outCanvasRef} style={{ width: dispW, height: dispH }} />

            {splitCompare && (
              <>
                <div
                  className="split-overlay"
                  style={{ clipPath: `inset(0 ${((1 - splitRatio) * 100).toFixed(2)}% 0 0)` }}
                >
                  <canvas ref={origCanvasRef} style={{ width: dispW, height: dispH }} />
                </div>
                <span className="split-badge" style={{ left: 10 }}>
                  {t(lang, '原图', 'Before')}
                </span>
                <span className="split-badge" style={{ right: 10 }}>
                  {t(lang, '效果', 'After')}
                </span>
                <div
                  className="split-handle"
                  style={{ left: `${(splitRatio * 100).toFixed(2)}%` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDraggingSplit(true);
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (draggingSplit) {
                      e.stopPropagation();
                      updateSplitFromClientX(e.clientX);
                    }
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    setDraggingSplit(false);
                  }}
                >
                  <div className="split-handle-knob" aria-hidden="true">
                    ⇄
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Calm Floating Stage Pill Controls */}
        <div className="stage-toolbar">
          <div className="stage-pill-group">
            <button
              type="button"
              className={`pill-action ${splitCompare ? 'active' : ''}`}
              onClick={onToggleSplit}
            >
              <Columns2 size={15} />
              <span>{t(lang, '对比原图', 'Compare')}</span>
            </button>

            <button
              type="button"
              className="pill-action"
              onClick={onRandomizeSeeds}
              title={t(lang, '随机更换噪点与抖动纹理 (快捷键 R)', 'Shuffle film grain & dither (R)')}
            >
              <Dices size={15} />
              <span>{t(lang, '换颗粒', 'Shuffle')}</span>
            </button>

            <button
              type="button"
              className={`pill-action ${isWideStandard ? 'active' : ''}`}
              onClick={onToggleAspectQuick}
              title={t(lang, '在 ZATO 978×404 宽屏与原图比例间切换', 'Toggle 978×404 wide crop or original aspect')}
            >
              <Maximize2 size={14} />
              <span>
                {isWideStandard ? t(lang, '宽屏裁切', 'Wide Crop') : t(lang, '原图比例', 'Original')}
              </span>
            </button>

            <span className="meta-chip desktop-only">
              {imgW} × {imgH}
            </span>
          </div>
        </div>
      </div>

      {/* Pro-Mode-Only Pipeline Stage Inspector */}
      {isProMode && (
        <div className="stage-strip" role="tablist" aria-label={t(lang, '管线步骤预览', 'Pipeline stages')}>
          {STAGE_ORDER.map((stageId, idx) => {
            const info = STAGE_LABELS[stageId];
            return (
              <React.Fragment key={stageId}>
                {idx > 0 && <span className="stage-arrow">›</span>}
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeStage === stageId}
                  className={`stage-pill ${activeStage === stageId ? 'active' : ''}`}
                  onClick={() => onSelectStage(stageId)}
                >
                  {lang === 'zh' ? info.zh : info.en}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Desktop Visible Drag-and-Drop Bar + Sample Switcher */}
      <div className="drop-bar">
        <button
          type="button"
          className="drop-bar-trigger"
          onClick={() => dropInputRef.current?.click()}
        >
          <Upload size={15} />
          <span>
            {t(
              lang,
              '拖放照片到此处，或点击上传（支持多图批量 / Ctrl+V 粘贴）',
              'Drop photo(s) here or click to upload · Ctrl+V supported',
            )}
          </span>
        </button>

        <div className="sample-strip">
          <span className="sample-label">{t(lang, '示例图：', 'Samples:')}</span>
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
        ref={dropInputRef}
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
    </section>
  );
};
