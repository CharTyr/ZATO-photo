import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Trash2 } from 'lucide-react';
import type { GradientStop, Lang } from '../types';
import { stopsToCssLinearGradient, type GradientPreset } from '../engine/gradients';
import { t } from '../i18n';

interface GradientEditorProps {
  stops: GradientStop[];
  reverse: boolean;
  presets: GradientPreset[];
  lang: Lang;
  onChangeStops: (stops: GradientStop[]) => void;
  onToggleReverse: () => void;
}

export const GradientEditor: React.FC<GradientEditorProps> = ({
  stops,
  reverse,
  presets,
  lang,
  onChangeStops,
  onToggleReverse,
}) => {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [selectedId, setSelectedId] = useState<string>(stops[0]?.id ?? '');
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...stops].sort((a, b) => a.position - b.position),
    [stops],
  );

  const selected = sorted.find((s) => s.id === selectedId) ?? sorted[0];

  const cssGrad = useMemo(
    () => stopsToCssLinearGradient(sorted, reverse),
    [sorted, reverse],
  );

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current || e.target !== barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const rawPos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const pos = reverse ? 1 - rawPos : rawPos;
    const newStop: GradientStop = {
      id: `stop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      position: Number(pos.toFixed(3)),
      color: selected?.color ?? '#888888',
    };
    onChangeStops([...sorted, newStop].sort((a, b) => a.position - b.position));
    setSelectedId(newStop.id);
  };

  const handlePinPointerDown = (id: string, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setSelectedId(id);
    setDraggingId(id);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePinPointerMove = (id: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingId !== id || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const rawPos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const pos = reverse ? 1 - rawPos : rawPos;
    onChangeStops(
      sorted.map((s) => (s.id === id ? { ...s, position: Number(pos.toFixed(3)) } : s)),
    );
  };

  const handlePinPointerUp = () => {
    setDraggingId(null);
  };

  const handleDeleteStop = () => {
    if (!selected || sorted.length <= 2) return;
    const next = sorted.filter((s) => s.id !== selected.id);
    onChangeStops(next);
    setSelectedId(next[0].id);
  };

  return (
    <div className="field-row" style={{ gap: 8 }}>
      <div className="field-inline">
        <select
          style={{ flex: 1, height: 34, fontSize: 13 }}
          value=""
          onChange={(e) => {
            const p = presets.find((item) => item.id === e.target.value);
            if (p) {
              const cloned = p.stops.map((s) => ({ ...s }));
              onChangeStops(cloned);
              setSelectedId(cloned[0]?.id ?? '');
            }
          }}
        >
          <option value="" disabled>
            {t(lang, '加载渐变预设...', 'Load gradient preset...')}
          </option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {lang === 'zh' ? p.nameZh : p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`btn btn-sm ${reverse ? 'btn-active' : ''}`}
          onClick={onToggleReverse}
          title={t(lang, '反转渐变方向', 'Reverse gradient')}
        >
          <ArrowLeftRight size={13} />
          {t(lang, '反转', 'Rev')}
        </button>
      </div>

      {/* Interactive Gradient Bar */}
      <div
        ref={barRef}
        className="grad-bar-wrap"
        style={{ background: cssGrad }}
        onClick={handleBarClick}
        title={t(lang, '点击渐变条添加色标，拖动下方滑块调整位置', 'Click bar to add stop; drag pins below')}
      >
        {sorted.map((stop) => {
          const leftPct = (reverse ? 1 - stop.position : stop.position) * 100;
          const isSel = selected?.id === stop.id;
          return (
            <div
              key={stop.id}
              className={`grad-stop-pin ${isSel ? 'selected' : ''}`}
              style={{ left: `${leftPct}%` }}
              onPointerDown={(e) => handlePinPointerDown(stop.id, e)}
              onPointerMove={(e) => handlePinPointerMove(stop.id, e)}
              onPointerUp={handlePinPointerUp}
            >
              <div className="grad-stop-dot" style={{ background: stop.color }} />
            </div>
          );
        })}
      </div>

      {/* Selected Stop Inspector */}
      {selected && (
        <div className="field-inline" style={{ marginTop: 2 }}>
          <label className="color-chip-input">
            <input
              type="color"
              value={selected.color}
              onChange={(e) =>
                onChangeStops(
                  sorted.map((s) => (s.id === selected.id ? { ...s, color: e.target.value } : s)),
                )
              }
            />
            <span>{selected.color.toUpperCase()}</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Pos</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              style={{ width: 64, height: 34, fontSize: 13 }}
              value={Math.round(selected.position * 100)}
              onChange={(e) => {
                const v = Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100;
                onChangeStops(
                  sorted.map((s) => (s.id === selected.id ? { ...s, position: v } : s)),
                );
              }}
            />
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>%</span>
          </div>
          <button
            type="button"
            className="btn btn-icon-sm"
            disabled={sorted.length <= 2}
            onClick={handleDeleteStop}
            aria-label={t(lang, '删除当前色标', 'Delete stop')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
