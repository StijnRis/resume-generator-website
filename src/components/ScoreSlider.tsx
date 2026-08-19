"use client";

import { useEffect, useState } from "react";

interface ScoreSliderProps {
  label: string;
  value: number;
  reason?: string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  compact?: boolean;
  /** Compact vertical stack for right-side item controls. */
  side?: boolean;
  meta?: string;
  valueLabel?: string;
  /** When true, only call onChange when the slider is released. */
  commitOnRelease?: boolean;
}

export function ScoreSlider({
  label,
  value,
  reason,
  onChange,
  min = 0,
  max = 5,
  compact = false,
  side = false,
  meta,
  valueLabel,
  commitOnRelease = false,
}: ScoreSliderProps) {
  const [draftValue, setDraftValue] = useState(value);
  const displayValue = commitOnRelease ? draftValue : value;

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  const commit = (nextValue: number) => {
    if (nextValue !== value) onChange(nextValue);
  };

  const handleChange = (nextValue: number) => {
    if (commitOnRelease) {
      setDraftValue(nextValue);
      return;
    }
    onChange(nextValue);
  };

  const handleRelease = () => {
    if (commitOnRelease) commit(draftValue);
  };

  const displayLabel = valueLabel ?? `${displayValue}/${max}`;

  const rangeInput = (
    <input
      type="range"
      min={min}
      max={max}
      step={1}
      value={displayValue}
      onChange={(e) => handleChange(parseInt(e.target.value, 10))}
      onMouseUp={handleRelease}
      onTouchEnd={handleRelease}
      onKeyUp={handleRelease}
      className={
        side || !compact
          ? "w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-zinc-200 accent-blue-600"
          : "w-20 h-1.5 rounded-lg appearance-none cursor-pointer bg-zinc-200 accent-blue-600 shrink-0"
      }
    />
  );

  const reasonEl = reason ? (
    <p className="text-xs text-zinc-500 leading-snug whitespace-pre-wrap">
      {reason}
    </p>
  ) : null;

  if (side) {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-zinc-600">{label}</span>
          <span className="text-sm font-semibold text-blue-600 shrink-0">
            {displayLabel}
          </span>
        </div>
        {rangeInput}
        {reasonEl}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-sm font-medium text-zinc-800 truncate">
                {label}
              </span>
              {meta && (
                <span className="text-xs text-zinc-500 shrink-0 whitespace-nowrap">
                  {meta}
                </span>
              )}
            </div>
          </div>
          <span className="text-sm font-semibold text-blue-600 shrink-0 min-w-[52px] text-right">
            {displayLabel}
          </span>
          {rangeInput}
        </div>
        {reasonEl}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700">{label}</span>
        <span className="text-sm font-bold text-blue-600">{displayLabel}</span>
      </div>
      {rangeInput}
      {reasonEl}
    </div>
  );
}
