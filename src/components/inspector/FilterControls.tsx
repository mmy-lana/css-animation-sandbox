'use client';

import { useCallback, useMemo } from 'react';
import { Blend, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ParameterField } from '@/components/inspector/ParameterField';
import { PropertySection } from '@/components/inspector/PropertySection';
import { cn } from '@/lib/cn';
import { composeFilterCSS } from '@/lib/cssGenerator';
import {
  DEFAULT_FILTER_PROPERTIES,
  FILTER_LIMITS,
  matchesDefaults,
  type FilterProperties,
} from '@/types/sandbox';

export interface FilterControlsProps {
  value: FilterProperties;
  onChange: (patch: Partial<FilterProperties>) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * CSS filter inspector. Percentage-based filters are stored 0…100, and the
 * composer in `cssGenerator` owns the `%` suffix; this panel only collects
 * values inside the declared per-filter limits.
 */
export function FilterControls({ value, onChange, disabled = false, className }: FilterControlsProps) {
  const isPristine = useMemo(() => matchesDefaults(DEFAULT_FILTER_PROPERTIES, value), [value]);
  const liveFilter = useMemo(() => composeFilterCSS(value), [value]);

  const patch = useCallback(
    (next: Partial<FilterProperties>) => {
      if (disabled) return;
      onChange(next);
    },
    [disabled, onChange],
  );

  return (
    <div className={cn('divide-y divide-obsidian-700/70', className)}>
      <PropertySection
        title="Filters"
        icon={Blend}
        description="Applied in order, left to right, exactly as the filter property composes them."
        actions={
          <Button
            size="icon-sm"
            variant="ghost"
            ariaLabel="Reset filters"
            disabled={disabled || isPristine}
            onClick={() => patch({ ...DEFAULT_FILTER_PROPERTIES })}
          >
            <Undo2 width={13} height={13} aria-hidden="true" />
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-3">
          <ParameterField
            label="Blur"
            value={value.blur}
            min={FILTER_LIMITS.blur.min}
            max={FILTER_LIMITS.blur.max}
            step={FILTER_LIMITS.blur.step}
            unit="px"
            disabled={disabled}
            onChange={(next) => patch({ blur: next })}
          />
          <ParameterField
            label="Brightness"
            value={value.brightness}
            min={FILTER_LIMITS.brightness.min}
            max={FILTER_LIMITS.brightness.max}
            step={FILTER_LIMITS.brightness.step}
            unit="%"
            tone="violet"
            disabled={disabled}
            onChange={(next) => patch({ brightness: next })}
          />
          <ParameterField
            label="Contrast"
            value={value.contrast}
            min={FILTER_LIMITS.contrast.min}
            max={FILTER_LIMITS.contrast.max}
            step={FILTER_LIMITS.contrast.step}
            unit="%"
            tone="violet"
            disabled={disabled}
            onChange={(next) => patch({ contrast: next })}
          />
          <ParameterField
            label="Saturation"
            value={value.saturate}
            min={FILTER_LIMITS.saturate.min}
            max={FILTER_LIMITS.saturate.max}
            step={FILTER_LIMITS.saturate.step}
            unit="%"
            tone="violet"
            disabled={disabled}
            onChange={(next) => patch({ saturate: next })}
          />
          <ParameterField
            label="Grayscale"
            value={value.grayscale}
            min={FILTER_LIMITS.grayscale.min}
            max={FILTER_LIMITS.grayscale.max}
            step={FILTER_LIMITS.grayscale.step}
            unit="%"
            tone="neutral"
            disabled={disabled}
            onChange={(next) => patch({ grayscale: next })}
          />
          <ParameterField
            label="Hue rotate"
            value={value.hueRotate}
            min={FILTER_LIMITS.hueRotate.min}
            max={FILTER_LIMITS.hueRotate.max}
            step={FILTER_LIMITS.hueRotate.step}
            unit="°"
            tone="neutral"
            disabled={disabled}
            onChange={(next) => patch({ hueRotate: next })}
          />
          <ParameterField
            label="Invert"
            value={value.invert}
            min={FILTER_LIMITS.invert.min}
            max={FILTER_LIMITS.invert.max}
            step={FILTER_LIMITS.invert.step}
            unit="%"
            tone="neutral"
            disabled={disabled}
            onChange={(next) => patch({ invert: next })}
          />
          <ParameterField
            label="Filter opacity"
            value={value.opacity}
            min={FILTER_LIMITS.opacity.min}
            max={FILTER_LIMITS.opacity.max}
            step={FILTER_LIMITS.opacity.step}
            unit="%"
            hint="Layer-level opacity, independent of the style opacity on the Box Shadow panel."
            disabled={disabled}
            onChange={(next) => patch({ opacity: next })}
          />
        </div>
      </PropertySection>

      <p className="readout px-3 py-2 text-[9px] text-zinc-400" title={liveFilter}>
        {liveFilter === 'none' ? 'filter: none' : liveFilter}
      </p>
    </div>
  );
}
