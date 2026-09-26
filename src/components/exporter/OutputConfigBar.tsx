'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import {
  EXPORT_TARGETS,
  EXPORT_TARGET_LABELS,
  validateExportOptions,
  type ExportOptions,
  type ExportTarget,
} from '@/types/sandbox';

export interface OutputConfigBarProps {
  options: ExportOptions;
  onChange: (patch: Partial<ExportOptions>, commit: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const TARGET_OPTIONS: ReadonlyArray<{ value: ExportTarget; label: string }> = EXPORT_TARGETS.map((value) => ({
  value,
  label: EXPORT_TARGET_LABELS[value],
}));

/**
 * Export configuration.
 *
 * Identifiers are validated on every keystroke but only normalized on commit,
 * so the field keeps showing what the user typed while the error message
 * disappears the moment the name becomes a legal CSS identifier.
 */
export function OutputConfigBar({ options, onChange, disabled = false, className }: OutputConfigBarProps) {
  const errors = useMemo(() => validateExportOptions(options), [options]);
  const errorFor = useMemo(() => {
    const map = new Map<string, string>();
    for (const error of errors) {
      if (!map.has(error.field)) map.set(error.field, error.message);
    }
    return map;
  }, [errors]);

  return (
    <div
      className={cn('flex flex-col gap-3 rounded-lg border border-obsidian-700/60 bg-obsidian-850/40 p-3', className)}
      aria-label="Export options"
    >
      <div className="grid gap-2 sm:grid-cols-3">
        <Select
          label="Target"
          value={options.target}
          options={TARGET_OPTIONS}
          onChange={(value) => onChange({ target: value }, true)}
          size="sm"
          disabled={disabled}
        />
        <label className="flex flex-col gap-1 text-[10px] tracking-wide text-zinc-500 uppercase">
          Class name
          <input
            type="text"
            value={options.animationClassName}
            onChange={(event) => onChange({ animationClassName: event.target.value }, false)}
            onBlur={(event) => onChange({ animationClassName: event.target.value.trim() }, true)}
            spellCheck={false}
            autoComplete="off"
            disabled={disabled}
            aria-invalid={errorFor.has('animationClassName') || undefined}
            aria-label="Animation class name"
            className={cn(
              'h-8 rounded-md border border-obsidian-700 bg-obsidian-900 px-2 font-mono text-xs text-zinc-100 outline-none',
              'placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-studio-accent',
              errorFor.has('animationClassName') && 'border-studio-danger',
            )}
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] tracking-wide text-zinc-500 uppercase">
          Keyframes rule
          <input
            type="text"
            value={options.keyframeRuleName}
            onChange={(event) => onChange({ keyframeRuleName: event.target.value }, false)}
            onBlur={(event) => onChange({ keyframeRuleName: event.target.value.trim() }, true)}
            spellCheck={false}
            autoComplete="off"
            disabled={disabled}
            aria-invalid={errorFor.has('keyframeRuleName') || undefined}
            aria-label="Keyframes rule name"
            className={cn(
              'h-8 rounded-md border border-obsidian-700 bg-obsidian-900 px-2 font-mono text-xs text-zinc-100 outline-none',
              'placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-studio-accent',
              errorFor.has('keyframeRuleName') && 'border-studio-danger',
            )}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Switch
          checked={options.includeVendorPrefixes}
          onCheckedChange={(checked) => onChange({ includeVendorPrefixes: checked }, true)}
          label="-webkit- keys"
          disabled={disabled}
          className="min-w-28"
        />
        <Switch
          checked={options.includeVariables}
          onCheckedChange={(checked) => onChange({ includeVariables: checked }, true)}
          label="Custom properties"
          disabled={disabled || options.target !== 'vanilla-css'}
          className="min-w-36"
        />
        <Switch
          checked={options.prettify}
          onCheckedChange={(checked) => onChange({ prettify: checked }, true)}
          label="Prettify"
          disabled={disabled}
          className="min-w-24"
        />
      </div>

      {errors.length > 0 ? (
        <p role="status" className="text-[10px] text-studio-danger">
          {errors.map((error) => `${error.field}: ${error.message}`).join(' · ')}
        </p>
      ) : null}
    </div>
  );
}
