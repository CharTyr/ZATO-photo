import React, { useRef, useState } from 'react';
import { Download, ImagePlus, Plus, Trash2, Upload } from 'lucide-react';
import type { Lang, NamedPalette } from '../types';
import {
  exportGimpGpl,
  exportJascPal,
  extractPaletteFromRgba,
  parsePaletteFile,
} from '../engine/palettes';
import { t } from '../i18n';

interface PaletteManagerProps {
  selectedPaletteId: string;
  palettes: NamedPalette[];
  lang: Lang;
  onSelectPalette: (id: string) => void;
  onAddPalette: (palette: NamedPalette) => void;
  onUpdatePaletteColors: (paletteId: string, colors: string[]) => void;
  onNotify: (msg: string) => void;
}

export const PaletteManager: React.FC<PaletteManagerProps> = ({
  selectedPaletteId,
  palettes,
  lang,
  onSelectPalette,
  onAddPalette,
  onUpdatePaletteColors,
  onNotify,
}) => {
  const palInputRef = useRef<HTMLInputElement | null>(null);
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const pendingCloneIdRef = useRef<string | null>(null);
  const [extractCount, setExtractCount] = useState<number>(16);
  const [selectedSwatchIdx, setSelectedSwatchIdx] = useState<number | null>(null);

  const activePalette =
    palettes.find((p) => p.id === selectedPaletteId) ?? palettes[0];

  if (activePalette && activePalette.id === pendingCloneIdRef.current) {
    pendingCloneIdRef.current = null;
  }

  const handleImportPaletteFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const parsed = parsePaletteFile(file.name, buf);
      if (parsed.colors.length < 2) {
        onNotify(t(lang, '未能解析出有效颜色，请检查 .PAL/.GPL/.HEX 文件', 'No valid colors found in palette file'));
        return;
      }
      const newPal: NamedPalette = {
        id: `custom_${Date.now().toString(36)}`,
        name: `${parsed.name} (${parsed.colors.length})`,
        colors: parsed.colors,
        source: 'imported',
      };
      onAddPalette(newPal);
      onSelectPalette(newPal.id);
      onNotify(
        t(
          lang,
          `已导入色板「${parsed.name}」(${parsed.colors.length} 色)`,
          `Imported "${parsed.name}" (${parsed.colors.length} colors)`,
        ),
      );
    } catch {
      onNotify(t(lang, '色板文件读取失败', 'Failed to parse palette file'));
    }
  };

  // Page 10 Aseprite replacement: extract indexed palette from any reference image
  const handleExtractFromImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 256;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const rgba = ctx.getImageData(0, 0, w, h).data;
        const colors = extractPaletteFromRgba(rgba, extractCount, true);
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const newPal: NamedPalette = {
          id: `extracted_${Date.now().toString(36)}`,
          name: `${baseName} (${colors.length}c)`,
          colors,
          source: 'extracted',
        };
        onAddPalette(newPal);
        onSelectPalette(newPal.id);
        onNotify(
          t(
            lang,
            `已从参考图提取 ${colors.length} 色（已自动剔除透明色）`,
            `Extracted ${colors.length} colors (transparent pixels skipped)`,
          ),
        );
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      onNotify(t(lang, '参考图加载失败', 'Failed to load reference image'));
    };
    img.src = url;
  };

  const downloadText = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ensureEditableCopyAndMutate = (mutator: (colors: string[]) => string[]) => {
    if (!activePalette) return;
    const nextColors = mutator([...activePalette.colors]);
    if (nextColors.length < 2) return;
    if (activePalette.source === 'builtin') {
      if (pendingCloneIdRef.current) {
        onUpdatePaletteColors(pendingCloneIdRef.current, nextColors);
        return;
      }
      const cloneId = `edited_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
      pendingCloneIdRef.current = cloneId;
      const cloned: NamedPalette = {
        id: cloneId,
        name: `${activePalette.name} (Edited)`,
        nameZh: activePalette.nameZh ? `${activePalette.nameZh}（已改）` : undefined,
        colors: nextColors,
        source: 'imported',
      };
      onAddPalette(cloned);
      onSelectPalette(cloned.id);
    } else {
      onUpdatePaletteColors(activePalette.id, nextColors);
    }
  };

  return (
    <div className="field-row" style={{ gap: 7 }}>
      <div className="field-label">
        <span>{t(lang, '调色板 Palette', 'Palette')}</span>
        <span className="field-value" style={{ color: 'var(--muted)' }}>
          {activePalette?.colors.length ?? 0} {t(lang, '色（暗→亮）', 'colors (dark→light)')}
        </span>
      </div>

      <select
        value={activePalette?.id ?? ''}
        onChange={(e) => {
          pendingCloneIdRef.current = null;
          onSelectPalette(e.target.value);
          setSelectedSwatchIdx(null);
        }}
      >
        {palettes.map((p) => (
          <option key={p.id} value={p.id}>
            {lang === 'zh' && p.nameZh ? p.nameZh : p.name}
          </option>
        ))}
      </select>

      {/* Swatch Preview & Editor */}
      {activePalette && (
        <div className="swatch-grid">
          {activePalette.colors.map((hex, idx) => (
            <button
              key={idx}
              type="button"
              className={`swatch-tile ${selectedSwatchIdx === idx ? 'selected' : ''}`}
              style={{ background: hex }}
              title={`${hex.toUpperCase()} — ${t(lang, '点击编辑或移除', 'Click to edit or remove')}`}
              onClick={() => setSelectedSwatchIdx(selectedSwatchIdx === idx ? null : idx)}
            />
          ))}
        </div>
      )}

      {/* Selected Swatch Inline Actions */}
      {activePalette && selectedSwatchIdx !== null && activePalette.colors[selectedSwatchIdx] && (
        <div className="field-inline">
          <label className="color-chip-input">
            <input
              type="color"
              value={activePalette.colors[selectedSwatchIdx]}
              onChange={(e) =>
                ensureEditableCopyAndMutate((cols) => {
                  cols[selectedSwatchIdx] = e.target.value;
                  return cols;
                })
              }
            />
            <span>{activePalette.colors[selectedSwatchIdx].toUpperCase()}</span>
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                const insertAt = selectedSwatchIdx + 1;
                const seedColor = activePalette.colors[selectedSwatchIdx] ?? '#808080';
                ensureEditableCopyAndMutate((cols) => {
                  cols.splice(insertAt, 0, seedColor);
                  return cols;
                });
                setSelectedSwatchIdx(insertAt);
              }}
            >
              <Plus size={11} />
              {t(lang, '增色', 'Add')}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={activePalette.colors.length <= 2}
              onClick={() => {
                ensureEditableCopyAndMutate((cols) =>
                  cols.filter((_, i) => i !== selectedSwatchIdx),
                );
                setSelectedSwatchIdx(null);
              }}
            >
              <Trash2 size={11} />
              {t(lang, '删除', 'Del')}
            </button>
          </div>
        </div>
      )}

      {/* Import .PAL / Extract from Reference Image */}
      <div className="grid-2" style={{ gap: 6 }}>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => palInputRef.current?.click()}
          title={t(lang, '导入 .PAL / .GPL / .HEX 色板文件', 'Import .PAL / .GPL / .HEX palette file')}
        >
          <Upload size={12} />
          {t(lang, '导入 .PAL/.GPL', 'Import .PAL')}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => imgInputRef.current?.click()}
          title={t(lang, '从任意参考图提取索引色板（自动忽略透明像素）', 'Extract indexed palette from any reference image')}
        >
          <ImagePlus size={12} />
          {t(lang, `从图提取 (${extractCount}色)`, `From Image (${extractCount})`)}
        </button>
      </div>

      {/* Extraction Color Count + Export .PAL / .GPL */}
      <div className="field-inline" style={{ gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            {t(lang, '提取色数', 'Extract')}
          </span>
          <input
            type="number"
            min={4}
            max={64}
            value={extractCount}
            style={{ width: 60, height: 30, fontSize: 13 }}
            onChange={(e) =>
              setExtractCount(Math.max(4, Math.min(64, Number(e.target.value) || 16)))
            }
          />
        </div>
        {activePalette && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn btn-sm btn-soft"
              onClick={() =>
                downloadText(
                  `${activePalette.id}.pal`,
                  exportJascPal(activePalette.colors),
                )
              }
              title={t(lang, '导出 .PAL 色板文件', 'Export .PAL palette file')}
            >
              <Download size={12} />
              .PAL
            </button>
            <button
              type="button"
              className="btn btn-sm btn-soft"
              onClick={() =>
                downloadText(
                  `${activePalette.id}.gpl`,
                  exportGimpGpl(activePalette.name, activePalette.colors),
                )
              }
              title={t(lang, '导出 .GPL 色板文件', 'Export .GPL palette file')}
            >
              <Download size={12} />
              .GPL
            </button>
          </div>
        )}
      </div>

      <input
        ref={palInputRef}
        type="file"
        accept=".pal,.gpl,.hex,.txt"
        hidden
        onChange={handleImportPaletteFile}
      />
      <input
        ref={imgInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleExtractFromImage}
      />
    </div>
  );
};
