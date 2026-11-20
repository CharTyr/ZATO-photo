import React, { useMemo, useRef, useState } from 'react';
import type { CurvePoint, Lang } from '../types';
import { buildCurveLut, CURVE_PRESETS } from '../engine/curves';
import { t } from '../i18n';

interface CurveEditorProps {
  points: CurvePoint[];
  histogram: Uint32Array;
  lang: Lang;
  onChange: (points: CurvePoint[]) => void;
}

const SVG_W = 256;
const SVG_H = 184;

export const CurveEditor: React.FC<CurveEditorProps> = ({
  points,
  histogram,
  lang,
  onChange,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number>(Math.min(1, points.length - 1));
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const sortedPoints = useMemo(
    () => [...points].sort((a, b) => a.x - b.x),
    [points],
  );

  const lut = useMemo(() => buildCurveLut(sortedPoints), [sortedPoints]);

  const toSvgX = (x: number) => (x / 255) * SVG_W;
  const toSvgY = (y: number) => SVG_H - (y / 255) * SVG_H;

  // Build SVG polyline for the smooth evaluated tone curve
  const curvePath = useMemo(() => {
    let d = '';
    for (let x = 0; x < 256; x += 2) {
      const sx = toSvgX(x);
      const sy = toSvgY(lut[x]);
      d += x === 0 ? `M ${sx.toFixed(1)} ${sy.toFixed(1)}` : ` L ${sx.toFixed(1)} ${sy.toFixed(1)}`;
    }
    d += ` L ${toSvgX(255).toFixed(1)} ${toSvgY(lut[255]).toFixed(1)}`;
    return d;
  }, [lut]);

  // Build normalized histogram area path (ignoring pure 0/255 clipping spikes for scaling)
  const histPath = useMemo(() => {
    let maxBin = 1;
    for (let i = 4; i < 252; i++) {
      if (histogram[i] > maxBin) maxBin = histogram[i];
    }
    // Fallback if image is purely binary
    if (maxBin <= 1) {
      for (let i = 0; i < 256; i++) {
        if (histogram[i] > maxBin) maxBin = histogram[i];
      }
    }
    let d = `M 0 ${SVG_H}`;
    for (let i = 0; i < 256; i += 2) {
      const val = Math.min(1, histogram[i] / maxBin);
      const sx = toSvgX(i);
      const sy = SVG_H - val * SVG_H * 0.85;
      d += ` L ${sx.toFixed(1)} ${sy.toFixed(1)}`;
    }
    d += ` L ${SVG_W} ${SVG_H} Z`;
    return d;
  }, [histogram]);

  const clientToCurve = (clientX: number, clientY: number): CurvePoint => {
    const rect = svgRef.current!.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    return { x: Math.round(nx * 255), y: Math.round(ny * 255) };
  };

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const pt = clientToCurve(e.clientX, e.clientY);

    // Check if near an existing point
    let hitIdx = -1;
    let bestDist = 16;
    sortedPoints.forEach((p, idx) => {
      const d = Math.hypot(p.x - pt.x, p.y - pt.y);
      if (d < bestDist) {
        bestDist = d;
        hitIdx = idx;
      }
    });

    if (hitIdx !== -1) {
      setSelectedIdx(hitIdx);
      setDraggingIdx(hitIdx);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } else {
      // Add new point and drag it
      const next = [...sortedPoints, pt].sort((a, b) => a.x - b.x);
      const newIdx = next.findIndex((p) => p.x === pt.x && p.y === pt.y);
      onChange(next);
      setSelectedIdx(newIdx);
      setDraggingIdx(newIdx);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingIdx === null || !svgRef.current) return;
    const pt = clientToCurve(e.clientX, e.clientY);
    const next = sortedPoints.map((p) => ({ ...p }));
    const isFirst = draggingIdx === 0;
    const isLast = draggingIdx === next.length - 1;

    if (isFirst) {
      next[0] = { x: 0, y: pt.y };
    } else if (isLast) {
      next[draggingIdx] = { x: 255, y: pt.y };
    } else {
      const minX = next[draggingIdx - 1].x + 2;
      const maxX = next[draggingIdx + 1].x - 2;
      next[draggingIdx] = {
        x: Math.max(minX, Math.min(maxX, pt.x)),
        y: pt.y,
      };
    }
    onChange(next);
  };

  const handleSvgPointerUp = () => {
    setDraggingIdx(null);
  };

  const handlePointDoubleClick = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (idx === 0 || idx === sortedPoints.length - 1 || sortedPoints.length <= 2) return;
    const next = sortedPoints.filter((_, i) => i !== idx);
    onChange(next);
    setSelectedIdx(Math.max(0, idx - 1));
  };

  const activePt = sortedPoints[Math.min(selectedIdx, sortedPoints.length - 1)] ?? { x: 0, y: 0 };

  return (
    <div className="curve-box">
      <div className="field-inline">
        <span className="field-label" style={{ fontSize: 11 }}>
          {t(lang, '色调曲线 (Ctrl+M)', 'Tone Curve (Ctrl+M)')}
        </span>
        <select
          style={{ width: 'auto', height: 22, fontSize: 11, padding: '0 6px' }}
          value=""
          onChange={(e) => {
            const preset = CURVE_PRESETS.find((p) => p.id === e.target.value);
            if (preset) {
              onChange(preset.points.map((pt) => ({ ...pt })));
              setSelectedIdx(Math.min(1, preset.points.length - 1));
            }
          }}
        >
          <option value="" disabled>
            {t(lang, '曲线预设...', 'Curve presets...')}
          </option>
          {CURVE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {lang === 'zh' ? p.nameZh : p.name}
            </option>
          ))}
        </select>
      </div>

      <svg
        ref={svgRef}
        className="curve-svg"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        onPointerDown={handleSvgPointerDown}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
      >
        {/* Subtle 4x4 grid */}
        {[0.25, 0.5, 0.75].map((f) => (
          <g key={f}>
            <line x1={SVG_W * f} y1={0} x2={SVG_W * f} y2={SVG_H} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <line x1={0} y1={SVG_H * f} x2={SVG_W} y2={SVG_H * f} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          </g>
        ))}
        {/* Identity diagonal */}
        <line x1={0} y1={SVG_H} x2={SVG_W} y2={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" strokeWidth="1" />
        {/* Live histogram */}
        <path d={histPath} fill="rgba(100, 210, 255, 0.18)" />
        {/* Evaluated monotone cubic curve */}
        <path d={curvePath} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="2.2" />
        {/* Control points */}
        {sortedPoints.map((p, idx) => (
          <circle
            key={`${idx}-${p.x}`}
            cx={toSvgX(p.x)}
            cy={toSvgY(p.y)}
            r={idx === selectedIdx ? 5.8 : 4.4}
            fill={idx === selectedIdx ? '#ffffff' : '#111620'}
            stroke="#ffffff"
            strokeWidth="2"
            style={{ cursor: 'grab' }}
            onDoubleClick={(e) => handlePointDoubleClick(idx, e)}
          />
        ))}
      </svg>

      <div className="field-inline" style={{ fontSize: 12, color: 'var(--muted)' }}>
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          IN: <strong style={{ color: 'var(--ink)' }}>{activePt.x}</strong> · OUT:{' '}
          <strong style={{ color: 'var(--ink)' }}>{activePt.y}</strong>
        </span>
        <span>{t(lang, '单击加点 · 双击删点', 'Click add · Dbl-click del')}</span>
      </div>
    </div>
  );
};
