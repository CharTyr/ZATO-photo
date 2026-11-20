import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface StepCardProps {
  stepNum: string;
  title: string;
  pdfPage?: string;
  enabled?: boolean;
  onToggleEnabled?: (next: boolean) => void;
  open: boolean;
  onToggleOpen: () => void;
  children: React.ReactNode;
}

export const StepCard: React.FC<StepCardProps> = ({
  stepNum,
  title,
  pdfPage,
  enabled,
  onToggleEnabled,
  open,
  onToggleOpen,
  children,
}) => {
  return (
    <section className={`step-card ${enabled === false ? 'disabled' : ''}`}>
      <div className="step-header" onClick={onToggleOpen}>
        <div className="step-header-left">
          {open ? (
            <ChevronDown size={15} color="var(--muted)" />
          ) : (
            <ChevronRight size={15} color="var(--muted)" />
          )}
          <span className="step-num">{stepNum}</span>
          <span className="step-title">{title}</span>
          {pdfPage && <span className="step-page">{pdfPage}</span>}
        </div>
        <div className="step-header-right" onClick={(e) => e.stopPropagation()}>
          {typeof enabled === 'boolean' && onToggleEnabled && (
            <button
              type="button"
              className={`toggle ${enabled ? 'on' : ''}`}
              aria-pressed={enabled}
              aria-label={title}
              onClick={() => onToggleEnabled(!enabled)}
            />
          )}
        </div>
      </div>
      {open && <div className="step-body">{children}</div>}
    </section>
  );
};
