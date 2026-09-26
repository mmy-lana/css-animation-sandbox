'use client';

import { useCallback, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type SliderTone = 'accent' | 'violet' | 'neutral';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Fired once when a drag or key interaction settles. */
  onCommit?: (value: number) => void;
  label?: ReactNode;
  /** Formatted text shown in the header and in the floating value bubble. */
  formatValue?: (value: number) => string;
  unit?: string;
  disabled?: boolean;
  tone?: SliderTone;
  ariaLabel?: string;
  className?: string;
  trackClassName?: string;
  /** Hides the header row entirely for dense inspector layouts. */
  hideLabel?: boolean;
}

const TONE_STYLES: Readonly<Record<SliderTone, { fill: string; bubble: string }>> = {
  accent: { fill: 'bg-studio-accent', bubble: 'bg-studio-accent text-obsidian-950' },
  violet: { fill: 'bg-studio-violet-soft', bubble: 'bg-studio-violet-soft text-white' },
  neutral: { fill: 'bg-zinc-400', bubble: 'bg-zinc-200 text-obsidian-950' },
};

/** Clamps `value` into range and snaps it to the nearest `step` boundary. */
export function quantizeSliderValue(value: number, min: number, max: number, step: number): number {
  const safeStep = step > 0 ? step : 1;
  const clamped = Math.min(Math.max(value, min), max);
  const steps = Math.round((clamped - min) / safeStep);
  const snapped = min + steps * safeStep;
  // Guard against float drift such as 0.30000000000000004.
  const decimals = (String(safeStep).split('.')[1] ?? '').length;
  return Math.min(Math.max(Number(snapped.toFixed(decimals + 2)), min), max);
}

/**
 * Precision slider. The native `input[type=range]` keeps full keyboard and
 * assistive-technology support; the visible track, fill and thumb are painted
 * on top of it, and a formatted value bubble tracks the thumb while it moves.
 */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  label,
  formatValue,
  unit,
  disabled = false,
  tone = 'accent',
  ariaLabel,
  className,
  trackClassName,
  hideLabel = false,
}: SliderProps) {
  const labelId = useId();
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);

  const format = useMemo(() => formatValue ?? ((next: number) => String(next)), [formatValue]);
  const span = max - min;
  const progress = span > 0 ? ((value - min) / span) * 100 : 0;
  const percentage = Math.min(Math.max(progress, 0), 100);
  const isInvalidRange = !(max > min) || !Number.isFinite(value);
  const displayValue = isInvalidRange ? '—' : `${format(value)}${unit ?? ''}`;

  const emit = useCallback(
    (next: number) => {
      const quantized = quantizeSliderValue(next, min, max, step);
      onChange(quantized);
      onCommit?.(quantized);
    },
    [max, min, onChange, onCommit, step],
  );

  const trackStyle = { '--slider-progress': `${percentage}%` } as CSSProperties;
  const toneStyle = TONE_STYLES[tone];
  const showBubble = (dragging || hovering) && !isInvalidRange && !disabled;

  return (
    <div className={cn('w-full select-none', disabled && 'opacity-50', className)} data-disabled={disabled || undefined}>
      {!hideLabel && label !== undefined ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span id={labelId} className="text-[11px] font-medium tracking-wide text-zinc-400 uppercase">
            {label}
          </span>
          <span className="readout text-[11px] text-zinc-200 tabular-nums">{displayValue}</span>
        </div>
      ) : null}

      <div className="relative">
        {showBubble ? (
          <div
            className={cn(
              'pointer-events-none absolute -top-7 z-10 -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold readout shadow-lg',
              'transition-[left] duration-75 ease-[var(--ease-studio)]',
              toneStyle.bubble,
            )}
            style={{ left: `${percentage}%` }}
            aria-hidden="true"
          >
            {displayValue}
          </div>
        ) : null}

        <div className="relative flex h-6 items-center">
          <div
            className={cn(
              'absolute inset-x-0 h-1.5 overflow-hidden rounded-full border border-obsidian-700 bg-obsidian-800',
              trackClassName,
            )}
            aria-hidden="true"
          >
            <div
              className={cn('h-full rounded-full transition-[width] duration-75 ease-[var(--ease-studio)]', toneStyle.fill)}
              style={trackStyle}
            />
          </div>

          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={Number.isFinite(value) ? value : min}
            disabled={disabled || isInvalidRange}
            aria-labelledby={hideLabel || label === undefined ? undefined : labelId}
            aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
            aria-valuetext={displayValue}
            onChange={(event) => emit(Number(event.target.value))}
            onPointerDown={() => setDragging(true)}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            onPointerEnter={() => setHovering(true)}
            onPointerLeave={() => setHovering(false)}
            onKeyUp={(event) => {
              if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) {
                onCommit?.(Number((event.target as HTMLInputElement).value));
              }
            }}
            className={cn(
              'relative z-10 h-6 w-full cursor-grab touch-none appearance-none bg-transparent active:cursor-grabbing',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-accent focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian-950',
              '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
              '[&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-obsidian-950 [&::-webkit-slider-thumb]:bg-zinc-100',
              '[&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.6)] [&::-webkit-slider-thumb]:transition-transform',
              'hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95',
              '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full',
              '[&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-obsidian-950 [&::-moz-range-thumb]:bg-zinc-100',
              'disabled:cursor-not-allowed',
            )}
          />
        </div>
      </div>
    </div>
  );
}
