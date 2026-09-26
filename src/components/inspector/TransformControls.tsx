'use client';

import { useCallback, useMemo } from 'react';
import { Move3d, Rotate3d, Scaling, Shrink, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select, type SelectOption } from '@/components/ui/Select';
import { ParameterField } from '@/components/inspector/ParameterField';
import { PropertySection } from '@/components/inspector/PropertySection';
import { cn } from '@/lib/cn';
import { composeTransformCSS } from '@/lib/cssGenerator';
import {
  DEFAULT_TRANSFORM_PROPERTIES,
  TRANSLATE_UNITS,
  TRANSLATE_UNIT_LABELS,
  TRANSFORM_LIMITS,
  matchesDefaults,
  type TransformProperties,
} from '@/types/sandbox';

export interface TransformControlsProps {
  value: TransformProperties;
  onChange: (patch: Partial<TransformProperties>) => void;
  disabled?: boolean;
  className?: string;
}

type TranslateUnit = TransformProperties['translateUnit'];

const UNIT_OPTIONS: ReadonlyArray<SelectOption<TranslateUnit>> = TRANSLATE_UNITS.map((unit) => ({
  value: unit,
  label: TRANSLATE_UNIT_LABELS[unit],
}));

/**
 * 3D transform inspector: translation, rotation, scale and skew. Every control
 * emits a partial patch so the caller can funnel changes through a single
 * history entry, and the composed transform string is shown verbatim as a
 * sanity check against the generated CSS.
 */
export function TransformControls({ value, onChange, disabled = false, className }: TransformControlsProps) {
  const isPristine = useMemo(() => matchesDefaults(DEFAULT_TRANSFORM_PROPERTIES, value), [value]);
  const liveTransform = useMemo(() => composeTransformCSS(value), [value]);

  const patch = useCallback(
    (next: Partial<TransformProperties>) => {
      if (disabled) return;
      onChange(next);
    },
    [disabled, onChange],
  );

  const reset = useCallback(() => {
    if (disabled) return;
    onChange({ ...DEFAULT_TRANSFORM_PROPERTIES });
  }, [disabled, onChange]);

  return (
    <div className={cn('divide-y divide-obsidian-700/70', className)}>
      <PropertySection
        title="Translate"
        icon={Move3d}
        defaultOpen
        actions={
          <Button
            size="icon-sm"
            variant="ghost"
            ariaLabel="Reset transform"
            disabled={disabled || isPristine}
            onClick={reset}
          >
            <Undo2 width={13} height={13} aria-hidden="true" />
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] tracking-wide text-zinc-500 uppercase">Axis unit</span>
            <div className="w-[104px] shrink-0">
              <Select
                value={value.translateUnit}
                options={UNIT_OPTIONS}
                size="sm"
                disabled={disabled}
                ariaLabel="Translation unit"
                onChange={(unit) => patch({ translateUnit: unit })}
              />
            </div>
          </div>
          <ParameterField
            label="X"
            value={value.translateX}
            min={TRANSFORM_LIMITS.translateX.min}
            max={TRANSFORM_LIMITS.translateX.max}
            step={TRANSFORM_LIMITS.translateX.step}
            unit={value.translateUnit}
            disabled={disabled}
            onChange={(next) => patch({ translateX: next })}
          />
          <ParameterField
            label="Y"
            value={value.translateY}
            min={TRANSFORM_LIMITS.translateY.min}
            max={TRANSFORM_LIMITS.translateY.max}
            step={TRANSFORM_LIMITS.translateY.step}
            unit={value.translateUnit}
            disabled={disabled}
            onChange={(next) => patch({ translateY: next })}
          />
          <ParameterField
            label="Z"
            value={value.translateZ}
            min={TRANSFORM_LIMITS.translateZ.min}
            max={TRANSFORM_LIMITS.translateZ.max}
            step={TRANSFORM_LIMITS.translateZ.step}
            unit="px"
            hint="Depth is always pixels — CSS rejects other units for translateZ."
            disabled={disabled}
            onChange={(next) => patch({ translateZ: next })}
          />
        </div>
      </PropertySection>

      <PropertySection title="Rotate" icon={Rotate3d} defaultOpen>
        <div className="grid grid-cols-1 gap-3">
          <ParameterField
            label="Rotate X"
            value={value.rotateX}
            min={TRANSFORM_LIMITS.rotateX.min}
            max={TRANSFORM_LIMITS.rotateX.max}
            step={TRANSFORM_LIMITS.rotateX.step}
            unit="°"
            tone="violet"
            disabled={disabled}
            onChange={(next) => patch({ rotateX: next })}
          />
          <ParameterField
            label="Rotate Y"
            value={value.rotateY}
            min={TRANSFORM_LIMITS.rotateY.min}
            max={TRANSFORM_LIMITS.rotateY.max}
            step={TRANSFORM_LIMITS.rotateY.step}
            unit="°"
            tone="violet"
            disabled={disabled}
            onChange={(next) => patch({ rotateY: next })}
          />
          <ParameterField
            label="Rotate Z"
            value={value.rotateZ}
            min={TRANSFORM_LIMITS.rotateZ.min}
            max={TRANSFORM_LIMITS.rotateZ.max}
            step={TRANSFORM_LIMITS.rotateZ.step}
            unit="°"
            tone="violet"
            disabled={disabled}
            onChange={(next) => patch({ rotateZ: next })}
          />
        </div>
      </PropertySection>

      <PropertySection title="Scale" icon={Scaling} defaultOpen>
        <div className="grid grid-cols-1 gap-3">
          <ParameterField
            label="Scale X"
            value={value.scaleX}
            min={TRANSFORM_LIMITS.scaleX.min}
            max={TRANSFORM_LIMITS.scaleX.max}
            step={TRANSFORM_LIMITS.scaleX.step}
            precision={2}
            disabled={disabled}
            onChange={(next) => patch({ scaleX: next })}
          />
          <ParameterField
            label="Scale Y"
            value={value.scaleY}
            min={TRANSFORM_LIMITS.scaleY.min}
            max={TRANSFORM_LIMITS.scaleY.max}
            step={TRANSFORM_LIMITS.scaleY.step}
            precision={2}
            disabled={disabled}
            onChange={(next) => patch({ scaleY: next })}
          />
          <ParameterField
            label="Scale Z"
            value={value.scaleZ}
            min={TRANSFORM_LIMITS.scaleZ.min}
            max={TRANSFORM_LIMITS.scaleZ.max}
            step={TRANSFORM_LIMITS.scaleZ.step}
            precision={2}
            disabled={disabled}
            onChange={(next) => patch({ scaleZ: next })}
          />
        </div>
      </PropertySection>

      <PropertySection title="Skew" icon={Shrink} defaultOpen={false}>
        <div className="grid grid-cols-1 gap-3">
          <ParameterField
            label="Skew X"
            value={value.skewX}
            min={TRANSFORM_LIMITS.skewX.min}
            max={TRANSFORM_LIMITS.skewX.max}
            step={TRANSFORM_LIMITS.skewX.step}
            unit="°"
            tone="neutral"
            disabled={disabled}
            onChange={(next) => patch({ skewX: next })}
          />
          <ParameterField
            label="Skew Y"
            value={value.skewY}
            min={TRANSFORM_LIMITS.skewY.min}
            max={TRANSFORM_LIMITS.skewY.max}
            step={TRANSFORM_LIMITS.skewY.step}
            unit="°"
            tone="neutral"
            disabled={disabled}
            onChange={(next) => patch({ skewY: next })}
          />
        </div>
      </PropertySection>

      <p className="readout px-3 py-2 text-[9px] text-zinc-600" title={liveTransform}>
        {liveTransform}
      </p>
    </div>
  );
}
