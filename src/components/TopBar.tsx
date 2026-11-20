import React, { useRef } from 'react';
import { Download, ImagePlus, Layers } from 'lucide-react';
import type { Lang } from '../types';
import { t } from '../i18n';

interface TopBarProps {
  lang: Lang;
  onToggleLang: () => void;
  onUploadFiles: (files: File[]) => void;
  onOpenBatch: () => void;
  onDownloadPng: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  lang,
  onToggleLang,
  onUploadFiles,
  onOpenBatch,
  onDownloadPng,
}) => {
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <header className="topbar">
      {/* Left Floating Liquid Glass Brand Capsule */}
      <div className="topbar-island">
        <div className="brand-capsule">
          <div className="brand-mark" aria-hidden="true">
            Z
          </div>
          <span className="brand-name">{t(lang, 'ZATO 滤镜', 'ZATO Filter')}</span>
        </div>
      </div>

      {/* Right Floating Liquid Glass Action Capsule */}
      <div className="topbar-island">
        <button
          type="button"
          className="btn"
          onClick={() => fileRef.current?.click()}
          aria-label={t(lang, '选择本地图片', 'Choose image')}
        >
          <ImagePlus size={15} />
          <span className="desktop-only">{t(lang, '换张图片', 'Photo')}</span>
          <span className="mobile-only">{t(lang, '换图', 'Photo')}</span>
        </button>

        <button
          type="button"
          className="btn btn-soft desktop-only"
          onClick={onOpenBatch}
          aria-label={t(lang, '批量处理多张图片', 'Batch process multiple photos')}
        >
          <Layers size={15} />
          <span>{t(lang, '批量处理', 'Batch')}</span>
        </button>

        <button
          type="button"
          className="btn btn-soft"
          style={{ padding: '0 11px', minWidth: 38 }}
          onClick={onToggleLang}
          aria-label={t(lang, '切换语言', 'Switch language')}
        >
          {lang === 'zh' ? 'EN' : '中'}
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onDownloadPng}
          aria-label={t(lang, '保存成图 PNG', 'Save PNG image')}
        >
          <Download size={15} />
          <span className="desktop-only">{t(lang, '保存图片', 'Save PNG')}</span>
          <span className="mobile-only">{t(lang, '保存', 'Save')}</span>
        </button>
      </div>

      <input
        ref={fileRef}
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
    </header>
  );
};
