'use client';

import { useCallback, useMemo } from 'react';
import { Boxes, Crosshair, Palette, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ColorInput } from '@/components/ui/ColorInput';
import { Switch } from '@/components/ui/Switch';
import { ParameterField } from '@/components/inspector/ParameterField';
import { PropertySection } from '@/components/inspector/PropertySection';
import { cn } from '@/lib/cn';
import { composeBoxShadowCSS } from '@/lib/cssGenerator';
import { DEFAULT_STYLE_PROPERTIES, STYLE_LIMITS, matchesDefaults, type StyleProperties } from '@/types/sandbox';

export interface StyleControlsProps {
  value: StyleProperties;
  onChange: (patch: Partial<StyleProperties>) => void;
  disabled?: boolean;
  className?: string;
}

interface TransformOriginPreset {
  label: string;
  x: number;
  y: number;
}

const ORIGIN_PRESETS: readonly TransformOriginPreset[] = [
  { label: 'Center', x: 50, y: 50 },
  { label: 'Top', x: 50, y: 0 },
  { label: 'Bottom', x: 50, y: 100 },
  { label: 'Left', x: 0, y: 50 },
  { label: 'Right', x: 100, y: 50 },
  { label: 'Top left', x: 0, y: 0 },
  { label: 'Bottom right', x: 100, y: 100 },
];

/**
 * Paint, shadow and transform-origin inspector. Colour edits go through
 * `ColorInput` (native picker + hex/rgb text + alpha), and the composed
 * `box-shadow` string is echoed back so an invalid combination is visible
 * before export.
 */
export function StyleControls({ value, onChange, disabled = false, className }: StyleControlsProps) {
  const isPristine = useMemo(() => matchesDefaults(DEFAULT_STYLE_PROPERTIES, value), [value]);
  const liveShadow = useMemo(() => composeBoxShadowCSS(value), [value]);

  const patch = useCallback(
    (next: Partial<StyleProperties>) => {
      if (disabled) return;
      onChange(next);
    },
    [disabled, onChange],
  );

  return (
    <div className={cn('divide-y divide-obsidian-700/70', className)}>
      <PropertySection
        title="Paint"
        icon={Palette}
        actions={
          <Button
            size="icon-sm"
            variant="ghost"
            ariaLabel="Reset styles"
            disabled={disabled || isPristine}
            onClick={() => patch({ ...DEFAULT_STYLE_PROPERTIES })}
          >
            <Undo2 width={13} height={13} aria-hidden="true" />
          </Button>
        }
      >
        <div className="space-y-3">
          <ColorInput
            label="Background"
            value={value.backgroundColor}
            disabled={disabled}
            onChange={(backgroundColor) => patch({ backgroundColor })}
          />
          <ColorInput
            label="Border"
            value={value.borderColor}
            disabled={disabled}
            onChange={(borderColor) => patch({ borderColor })}
          />
          <ParameterField
            label="Border width"
            value={value.borderWidth}
            min={STYLE_LIMITS.borderWidth.min}
            max={STYLE_LIMITS.borderWidth.max}
            step={STYLE_LIMITS.borderWidth.step}
            unit="px"
            precision={0}
            disabled={disabled}
            onChange={(next) => patch({ borderWidth: next })}
          />
          <ParameterField
            label="Corner radius"
            value={value.borderRadius}
            min={STYLE_LIMITS.borderRadius.min}
            max={STYLE_LIMITS.borderRadius.max}
            step={STYLE_LIMITS.borderRadius.step}
            unit="px"
            precision={0}
            disabled={disabled}
            onChange={(next) => patch({ borderRadius: next })}
          />
          <ParameterField
            label="Opacity"
            value={value.opacity}
            min={STYLE_LIMITS.opacity.min}
            max={STYLE_LIMITS.opacity.max}
            step={STYLE_LIMITS.opacity.step}
            unit="%"
            precision={0}
            hint="Distinct from filter opacity, which composites the whole layer."
            disabled={disabled}
            onChange={(next) => patch({ opacity: next })}
          />
        </div>
      </PropertySection>

      <PropertySection title="Box shadow" icon={Boxes} defaultOpen={false}>
        <div className="space-y-3">
          <ColorInput
            label="Shadow color"
            value={value.boxShadowColor}
            disabled={disabled}
            onChange={(boxShadowColor) => patch({ boxShadowColor })}
          />
          <div className="grid grid-cols-2 gap-3">
            <ParameterField
              label="X"
              value={value.boxShadowX}
              min={STYLE_LIMITS.boxShadowX.min}
              max={STYLE_LIMITS.boxShadowX.max}
              step={STYLE_LIMITS.boxShadowX.step}
              unit="px"
              precision={0}
              disabled={disabled}
              onChange={(next) => patch({ boxShadowX: next })}
            />
            <ParameterField
              label="Y"
              value={value.boxShadowY}
              min={STYLE_LIMITS.boxShadowY.min}
              max={STYLE_LIMITS.boxShadowY.max}
              step={STYLE_LIMITS.boxShadowY.step}
              unit="px"
              precision={0}
              disabled={disabled}
              onChange={(next) => patch({ boxShadowY: next })}
            />
            <ParameterField
              label="Blur"
              value={value.boxShadowBlur}
              min={STYLE_LIMITS.boxShadowBlur.min}
              max={STYLE_LIMITS.boxShadowBlur.max}
              step={STYLE_LIMITS.boxShadowBlur.step}
              unit="px"
              precision={0}
              disabled={disabled}
              onChange={(next) => patch({ boxShadowBlur: next })}
            />
            <ParameterField
              label="Spread"
              value={value.boxShadowSpread}
              min={STYLE_LIMITS.boxShadowSpread.min}
              max={STYLE_LIMITS.boxShadowSpread.max}
              step={STYLE_LIMITS.boxShadowSpread.step}
              unit="px"
              precision={0}
              disabled={disabled}
              onChange={(next) => patch({ boxShadowSpread: next })}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] tracking-wide text-zinc-500 uppercase">Inset</span>
            <Switch
              checked={value.boxShadowInset}
              disabled={disabled}
              ariaLabel="Inset box shadow"
              onCheckedChange={(boxShadowInset) => patch({ boxShadowInset })}
            />
          </div>
          <p className="readout px-2 py-1.5 text-[9px] text-zinc-600" title={liveShadow}>
            {liveShadow}
          </p>
        </div>
      </PropertySection>

      <PropertySection title="Transform origin" icon={Crosshair} defaultOpen={false}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ParameterField
              label="Origin X"
              value={value.transformOriginX}
              min={STYLE_LIMITS.transformOriginX.min}
              max={STYLE_LIMITS.transformOriginX.max}
              step={STYLE_LIMITS.transformOriginX.step}
              unit="%"
              precision={1}
              disabled={disabled}
              onChange={(next) => patch({ transformOriginX: next })}
            />
            <ParameterField
              label="Origin Y"
              value={value.transformOriginY}
              min={STYLE_LIMITS.transformOriginY.min}
              max={STYLE_LIMITS.transformOriginY.max}
              step={STYLE_LIMITS.transformOriginY.step}
              unit="%"
              precision={1}
              disabled={disabled}
              onChange={(next) => patch({ transformOriginY: next })}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {ORIGIN_PRESETS.map((preset) => {
              const active = value.transformOriginX === preset.x && value.transformOriginY === preset.y;
              return (
                <button
                  key={preset.label}
                  type="button"
                  disabled={disabled}
                  aria-pressed={active}
                  onClick={() => patch({ transformOriginX: preset.x, transformOriginY: preset.y })}
                  className={cn(
                    'rounded-md border px-1.5 py-0.5 text-[9px] transition-colors',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-accent',
                    'disabled:pointer-events-none',
                    active
                      ? 'border-studio-accent/60 bg-studio-accent/15 text-studio-accent'
                      : 'border-obsidian-700 text-zinc-500 hover:border-obsidian-600 hover:text-zinc-300',
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </PropertySection>
    </div>
  );
}
