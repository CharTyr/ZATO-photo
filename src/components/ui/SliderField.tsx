import React from 'react';

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  formatValue?: (v: number) => string;
  className?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export const SliderField: React.FC<SliderFieldProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  formatValue,
  className,
  disabled,
  onChange,
}) => {
  const display = formatValue ? formatValue(value) : String(value);
  const span = max - min;
  const pct = span > 0 ? Math.max(0, Math.min(100, ((value - min) / span) * 100)) : 0;

  const handleReset = () => {
    if (defaultValue !== undefined && !disabled) {
      onChange(defaultValue);
    }
  };

  return (
    <div className="field-row">
      <div className="field-label">
        <span>{label}</span>
        <span
          className="field-value"
          title={defaultValue !== undefined ? '双击重置 / Double-click to reset' : undefined}
          onDoubleClick={handleReset}
        >
          {display}
        </span>
      </div>
      <input
        type="range"
        className={className}
        style={{ '--slider-pct': `${pct.toFixed(1)}%` } as React.CSSProperties}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onDoubleClick={handleReset}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
};
