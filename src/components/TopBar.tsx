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

        <a
          href="https://github.com/CharTyr/ZATO-photo"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-soft btn-icon"
          style={{ textDecoration: 'none' }}
          aria-label={t(lang, '前往 GitHub 仓库', 'Open GitHub repository')}
          title={t(lang, '查看 GitHub 仓库', 'View on GitHub')}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 0.297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
        </a>

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
