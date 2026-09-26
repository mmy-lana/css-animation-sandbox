'use client';

import type { ReactNode } from 'react';
import { NumberInput } from '@/components/ui/NumberInput';
import { Slider, type SliderTone } from '@/components/ui/Slider';
import { cn } from '@/lib/cn';

export interface ParameterFieldProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  precision?: number;
  unit?: string;
  tone?: SliderTone;
  disabled?: boolean;
  /** Renders a secondary hint line under the control. */
  hint?: ReactNode;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  className?: string;
}

/**
 * Inspector control that pairs a precision slider with a typed numeric field.
 * Both inputs share one value and one range, so dragging and typing can never
 * disagree — the slider quantises, the number field validates the boundary.
 */
export function ParameterField({
  label,
  value,
  min,
  max,
  step,
  precision = 2,
  unit,
  tone = 'accent',
  disabled = false,
  hint,
  onChange,
  onCommit,
  className,
}: ParameterFieldProps) {
  const labelText = typeof label === 'string' ? label : undefined;

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">{label}</span>
        <div className="w-[104px] shrink-0">
          <NumberInput
            value={value}
            min={min}
            max={max}
            step={step}
            precision={precision}
            unit={unit}
            disabled={disabled}
            ariaLabel={labelText}
            onChange={onChange}
            onCommit={onCommit}
          />
        </div>
      </div>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        tone={tone}
        hideLabel
        ariaLabel={labelText}
        formatValue={(next) => next.toFixed(Math.min(precision, 2))}
        onChange={onChange}
        onCommit={onCommit}
      />
      {hint ? <p className="text-[9px] leading-snug text-zinc-400">{hint}</p> : null}
    </div>
  );
}
