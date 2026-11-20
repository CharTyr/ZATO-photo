import React, { useRef, useState } from 'react';
import { CheckCircle2, Download, Loader2, Upload, X } from 'lucide-react';
import type { Lang, NamedPalette, ZatoConfig } from '../types';
import { runZatoPipeline, type PixelBuffer } from '../engine/pipeline';
import { t } from '../i18n';

interface BatchModalProps {
  lang: Lang;
  initialFiles?: File[];
  config: ZatoConfig;
  palettes: NamedPalette[];
  renderResampled: (img: HTMLImageElement, cfg: ZatoConfig) => PixelBuffer;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

interface BatchItem {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'done' | 'error';
  dataUrl?: string;
  outName: string;
}

function filesToBatchItems(files: File[]): BatchItem[] {
  return files.map((file) => {
    const base = file.name.replace(/\.[^.]+$/, '');
    return {
      id: `${file.name}_${file.size}_${Math.random().toString(36).slice(2, 6)}`,
      file,
      status: 'pending',
      outName: `${base}_zato.png`,
    };
  });
}

export const BatchModal: React.FC<BatchModalProps> = ({
  lang,
  initialFiles,
  config,
  palettes,
  renderResampled,
  onClose,
  onNotify,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<BatchItem[]>(() =>
    initialFiles && initialFiles.length > 0 ? filesToBatchItems(initialFiles) : [],
  );
  const [running, setRunning] = useState(false);

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setItems((prev) => [...prev, ...filesToBatchItems(files)]);
  };

  const loadImage = (file: File): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });

  const handleRunBatch = async () => {
    if (items.length === 0 || running) return;
    setRunning(true);
    let completed = 0;

    for (const item of items) {
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'processing' } : it)),
      );
      try {
        const img = await loadImage(item.file);
        const srcBuf = renderResampled(img, config);
        const res = runZatoPipeline(srcBuf, config, palettes, 'final');
        const c = document.createElement('canvas');
        c.width = res.buffer.width;
        c.height = res.buffer.height;
        const ctx = c.getContext('2d')!;
        const imgData = ctx.createImageData(res.buffer.width, res.buffer.height);
        imgData.data.set(res.buffer.data);
        ctx.putImageData(imgData, 0, 0);
        const dataUrl = c.toDataURL('image/png');
        completed++;
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: 'done', dataUrl } : it)),
        );
      } catch {
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: 'error' } : it)),
        );
      }
      // Yield to browser UI between images
      await new Promise((r) => setTimeout(r, 15));
    }

    setRunning(false);
    onNotify(
      t(lang, `批量转换完成：${completed} / ${items.length} 张`, `Batch finished: ${completed} / ${items.length}`),
    );
  };

  const handleDownloadAll = async () => {
    const doneItems = items.filter((it) => it.status === 'done' && it.dataUrl);
    for (const it of doneItems) {
      const a = document.createElement('a');
      a.href = it.dataUrl!;
      a.download = it.outName;
      a.click();
      await new Promise((r) => setTimeout(r, 140));
    }
  };

  const doneCount = items.filter((i) => i.status === 'done').length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {t(lang, '批量图片生成（使用当前风格）', 'Batch Generator (Current Style)')}
          </div>
          <button
            type="button"
            className="btn btn-icon-sm btn-soft"
            onClick={onClose}
            aria-label={t(lang, '关闭弹窗', 'Close')}
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="sub-note">
            {t(
              lang,
              '选择或拖入多张照片，使用你当前设置好的风格与构图参数一键批量生成 ZATO 风格 PNG。',
              'Select or drop multiple photos to batch-render them with your active style settings into PNGs.',
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn"
              onClick={() => inputRef.current?.click()}
              disabled={running}
            >
              <Upload size={15} />
              {t(lang, '添加图片...', 'Add Images...')}
            </button>
            {items.length > 0 && (
              <button
                type="button"
                className="btn btn-soft"
                disabled={running}
                onClick={() => setItems([])}
              >
                {t(lang, '清空列表', 'Clear')}
              </button>
            )}
          </div>

          <div
            style={{
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 16,
              background: 'rgba(0,0,0,0.26)',
              minHeight: 140,
              maxHeight: 280,
              overflowY: 'auto',
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {items.length === 0 ? (
              <div style={{ margin: 'auto', color: 'var(--muted)', fontSize: 13.5 }}>
                {t(lang, '暂未添加图片，点击上方按钮选择', 'No images added yet')}
              </div>
            ) : (
              items.map((it) => (
                <div
                  key={it.id}
                  className="field-inline"
                  style={{
                    padding: '8px 10px',
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    {it.dataUrl ? (
                      <img
                        src={it.dataUrl}
                        alt={it.outName}
                        style={{
                          width: 60,
                          height: 26,
                          objectFit: 'cover',
                          borderRadius: 6,
                          border: '1px solid rgba(255,255,255,0.24)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 60,
                          height: 26,
                          background: 'rgba(255,255,255,0.08)',
                          borderRadius: 6,
                          border: '1px solid rgba(255,255,255,0.12)',
                        }}
                      />
                    )}
                    <span
                      style={{
                        fontSize: 13,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {it.file.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {it.status === 'processing' && <Loader2 size={15} color="var(--accent)" />}
                    {it.status === 'done' && (
                      <>
                        <CheckCircle2 size={15} color="var(--accent)" />
                        <a
                          href={it.dataUrl}
                          download={it.outName}
                          className="btn btn-sm btn-soft"
                          style={{ textDecoration: 'none' }}
                          aria-label={t(lang, '下载此图', 'Download')}
                        >
                          <Download size={13} />
                        </a>
                      </>
                    )}
                    {it.status === 'pending' && (
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {t(lang, '待处理', 'Pending')}
                      </span>
                    )}
                    {it.status === 'error' && (
                      <span style={{ fontSize: 12, color: 'var(--danger)' }}>
                        {t(lang, '失败', 'Error')}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="modal-footer">
          {doneCount > 0 && (
            <button type="button" className="btn" onClick={handleDownloadAll}>
              <Download size={13} />
              {t(lang, `全部下载 (${doneCount})`, `Download All (${doneCount})`)}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={items.length === 0 || running}
            onClick={handleRunBatch}
          >
            {running
              ? t(lang, '正在转换...', 'Processing...')
              : t(lang, `开始批量转换 (${items.length})`, `Process (${items.length})`)}
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleSelectFiles}
        />
      </div>
    </div>
  );
};
