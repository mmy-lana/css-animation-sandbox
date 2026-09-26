'use client';

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Pipette, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  STUDIO_SWATCHES,
  TRANSPARENCY_CHECKER,
  clampAlpha,
  clampChannel,
  colorsEqual,
  formatColorValue,
  parseCssColor,
  readableTextColor,
  rgbaToHex,
  type ColorFormatMode,
  type RgbaColor,
} from '@/lib/color';

export interface ColorInputProps {
  /** Any CSS colour string; unparseable input renders the error state. */
  value: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  label?: ReactNode;
  disabled?: boolean;
  /** Forces the notation used in the text field; inferred from `value` otherwise. */
  format?: ColorFormatMode;
  showAlpha?: boolean;
  showPresets?: boolean;
  presets?: readonly string[];
  ariaLabel?: string;
  className?: string;
}

const FALLBACK: RgbaColor = { r: 0, g: 0, b: 0, a: 1 };

function inferFormat(value: string): ColorFormatMode {
  return parseCssColor(value) === null ? 'hex' : value.trim().startsWith('#') ? 'hex' : 'rgb';
}

/**
 * Colour control combining a native picker, a notation-aware text field, RGB
 * channels and an alpha slider. The text field is committed on blur/Enter and
 * reports a dedicated error state for unparseable input, so a malformed colour
 * can never reach the generated stylesheet.
 */
export function ColorInput({
  value,
  onChange,
  onCommit,
  label,
  disabled = false,
  format,
  showAlpha = true,
  showPresets = true,
  presets = STUDIO_SWATCHES,
  ariaLabel,
  className,
}: ColorInputProps) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const parsed = useMemo(() => parseCssColor(value), [value]);
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [showChannels, setShowChannels] = useState(false);

  const mode: ColorFormatMode = format ?? inferFormat(value);
  const color = parsed ?? FALLBACK;
  const textValue = draft ?? (parsed === null ? value : formatColorValue(color, mode));

  useEffect(() => {
    setDraft(null);
    setInvalid(false);
  }, [value]);

  const emit = useCallback(
    (next: RgbaColor, commit = false) => {
      const formatted = formatColorValue(next, mode);
      setInvalid(false);
      setDraft(null);
      onChange(formatted);
      if (commit) onCommit?.(formatted);
    },
    [mode, onChange, onCommit],
  );

  const commitDraft = useCallback(() => {
    const raw = (draft ?? '').trim();
    if (raw.length === 0) {
      setDraft(null);
      setInvalid(false);
      return;
    }
    const next = parseCssColor(raw);
    if (!next) {
      setInvalid(true);
      return;
    }
    setDraft(null);
    setInvalid(false);
    const formatted = formatColorValue(next, mode);
    onChange(formatted);
    onCommit?.(formatted);
  }, [draft, mode, onChange, onCommit]);

  const setChannel = useCallback(
    (channel: keyof Omit<RgbaColor, 'a'>, raw: string) => {
      const next = Number.parseInt(raw, 10);
      emit({ ...color, [channel]: clampChannel(next) });
    },
    [color, emit],
  );

  const error = invalid ? 'Enter a hex or rgb() colour' : parsed === null ? 'Unsupported colour value' : null;
  const swatchBackground = parsed === null ? 'transparent' : formatColorValue(color, 'rgb');

  return (
    <div className={cn('w-full', disabled && 'opacity-50', className)}>
      {label !== undefined ? (
        <label htmlFor={fieldId} className="mb-1.5 block text-[11px] font-medium tracking-wide text-zinc-400 uppercase">
          {label}
        </label>
      ) : null}

      <div
        className={cn(
          'flex items-center gap-2 rounded-[10px] border bg-obsidian-850 px-2 py-1.5 transition-colors duration-150',
          'focus-within:border-studio-accent/70',
          error ? 'border-studio-danger/70' : 'border-obsidian-700',
        )}
      >
        <label
          className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-obsidian-600"
          style={{ backgroundColor: TRANSPARENCY_CHECKER, backgroundSize: '10px 10px' }}
          title="Open the system colour picker"
        >
          <span className="absolute inset-0" style={{ backgroundColor: swatchBackground }} />
          <input
            type="color"
            value={rgbaToHex(color)}
            disabled={disabled}
            aria-label={ariaLabel ?? (typeof label === 'string' ? `${label} colour picker` : 'Colour picker')}
            onChange={(event) => emit(parseCssColor(event.target.value) ?? FALLBACK, true)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>

        <div className="min-w-0 flex-1">
          <input
            id={fieldId}
            type="text"
            value={textValue}
            disabled={disabled}
            spellCheck={false}
            autoComplete="off"
            aria-label={ariaLabel ?? (typeof label === 'string' ? label : 'Colour value')}
            aria-invalid={error !== null || undefined}
            aria-errormessage={error ? errorId : undefined}
            onChange={(event) => {
              setDraft(event.target.value);
              setInvalid(false);
            }}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitDraft();
              }
              if (event.key === 'Escape') {
                setDraft(null);
                setInvalid(false);
              }
            }}
            className="readout w-full bg-transparent text-[11px] text-zinc-100 outline-none placeholder:text-zinc-600"
            placeholder="#00f5d4"
          />
        </div>

        {showAlpha ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <label htmlFor={`${fieldId}-alpha`} className="text-[10px] text-zinc-500">
              A
            </label>
            <input
              id={`${fieldId}-alpha`}
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={color.a}
              disabled={disabled}
              aria-label="Alpha channel"
              aria-valuetext={`${Math.round(color.a * 100)}%`}
              onChange={(event) => emit({ ...color, a: clampAlpha(Number(event.target.value)) })}
              className="h-1 w-14 cursor-pointer appearance-none rounded-full border border-obsidian-700 bg-obsidian-800 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-studio-accent [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-studio-accent"
            />
            <span className="readout w-8 text-right text-[10px] text-zinc-500">
              {Math.round(color.a * 100)}%
            </span>
          </div>
        ) : null}

        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowChannels((previous) => !previous)}
          aria-expanded={showChannels}
          aria-label="Toggle RGB channels"
          title="Toggle RGB channels"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-obsidian-800 hover:text-studio-accent disabled:pointer-events-none"
        >
          <Pipette width={13} height={13} aria-hidden="true" />
        </button>
      </div>

      {showChannels ? (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {(['r', 'g', 'b', 'a'] as const).map((channel) => {
            const isAlpha = channel === 'a';
            const current = isAlpha ? color.a : color[channel];
            return (
              <label key={channel} className="flex items-center gap-1 rounded-md border border-obsidian-700/70 bg-obsidian-850 px-1.5 py-1">
                <span className="text-[9px] text-zinc-500 uppercase">{channel}</span>
                <input
                  type="number"
                  min={0}
                  max={isAlpha ? 1 : 255}
                  step={isAlpha ? 0.01 : 1}
                  value={isAlpha ? Number(current.toFixed(2)) : current}
                  disabled={disabled}
                  aria-label={`${channel} channel`}
                  onChange={(event) => {
                    const parsedChannel = Number.parseFloat(event.target.value);
                    if (!Number.isFinite(parsedChannel)) return;
                    emit({ ...color, [channel]: isAlpha ? clampAlpha(parsedChannel) : clampChannel(parsedChannel) });
                  }}
                  className="readout w-full min-w-0 bg-transparent text-[10px] text-zinc-200 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </label>
            );
          })}
        </div>
      ) : null}

      {showPresets ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((preset) => {
            const isActive = colorsEqual(preset, value);
            return (
              <button
                key={preset}
                type="button"
                disabled={disabled}
                title={preset}
                aria-label={`Use ${preset}`}
                aria-pressed={isActive}
                onClick={() => {
                  const next = parseCssColor(preset);
                  if (next) emit(next, true);
                }}
                style={{
                  backgroundColor: TRANSPARENCY_CHECKER,
                  backgroundSize: '8px 8px',
                  color: readableTextColor(preset),
                }}
                className={cn(
                  'grid h-5 w-5 place-items-center overflow-hidden rounded border text-[8px] font-bold',
                  'transition-transform duration-150 hover:scale-110 disabled:pointer-events-none',
                  isActive ? 'border-studio-accent' : 'border-obsidian-600',
                )}
              >
                <span
                  aria-hidden="true"
                  className="grid h-full w-full place-items-center"
                  style={{ backgroundColor: formatColorValue(parseCssColor(preset) ?? FALLBACK, 'rgb') }}
                >
                  {isActive ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="mt-1 flex items-center gap-1 text-[10px] text-studio-danger">
          <AlertTriangle width={11} height={11} aria-hidden="true" className="shrink-0" />
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={disabled || color.a >= 1}
        onClick={() => emit({ ...color, a: 1 }, true)}
        className="mt-1 inline-flex items-center gap-1 text-[10px] text-zinc-500 transition-colors hover:text-studio-accent disabled:pointer-events-none disabled:opacity-40"
      >
        <RotateCcw width={10} height={10} aria-hidden="true" />
        Reset alpha
      </button>
    </div>
  );
}
