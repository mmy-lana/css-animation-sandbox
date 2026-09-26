'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { AlertTriangle, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { clampNumber } from '@/types/sandbox';

export interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  /** Fired when the value is committed (blur, Enter, or stepper press). */
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Decimal places kept when the typed string is parsed. */
  precision?: number;
  label?: ReactNode;
  unit?: string;
  disabled?: boolean;
  /** Validation message; also flips the control into its error state. */
  error?: string | null;
  ariaLabel?: string;
  className?: string;
  /** Pixels of label travel per pointer move when scrubbing. */
  scrubSensitivity?: number;
}

interface ParsedEntry {
  value: number;
  error: string | null;
}

/** Parses user input, rejecting anything that is not a finite number in range. */
export function parseNumericEntry(raw: string, min: number, max: number): ParsedEntry {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { value: 0, error: 'Enter a value' };
  if (trimmed === '-' || trimmed === '.' || trimmed === '-.') return { value: 0, error: 'Enter a value' };
  if (!/^-?\d*\.?\d+(e[-+]?\d+)?$/i.test(trimmed)) return { value: Number.NaN, error: 'Numbers only' };

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return { value: Number.NaN, error: 'Not a finite number' };
  if (parsed < min) return { value: parsed, error: `Minimum is ${min}` };
  if (parsed > max) return { value: parsed, error: `Maximum is ${max}` };
  return { value: parsed, error: null };
}

/**
 * Numeric field with three input paths: typed text, spinner buttons and
 * pointer-scrubbing on the label. Typed text stays free while the user types
 * (so intermediate states like `-` or `1.` are not clobbered) and is validated
 * on every keystroke, then committed on blur or Enter.
 */
export function NumberInput({
  value,
  onChange,
  onCommit,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  precision = 2,
  label,
  unit,
  disabled = false,
  error = null,
  ariaLabel,
  className,
  scrubSensitivity = 4,
}: NumberInputProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [scrubbing, setScrubbing] = useState(false);

  const finite = Number.isFinite(value);
  const stepSize = Number.isFinite(step) && step > 0 ? step : 1;
  const decimals = Math.max(0, Math.min(6, Math.trunc(precision)));
  const displayValue = draft ?? (finite ? String(Number(value.toFixed(decimals))) : '');
  const message = error ?? localError;
  const hasError = message !== null && message !== undefined;

  useEffect(() => {
    if (!scrubbing) setDraft(null);
  }, [scrubbing, value]);

  const applyValue = useCallback(
    (next: number, commit: boolean) => {
      const clamped = clampNumber(next, min, max, value);
      const rounded = Number(clamped.toFixed(decimals));
      setLocalError(null);
      onChange(rounded);
      if (commit) onCommit?.(rounded);
    },
    [decimals, max, min, onChange, onCommit, value],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      setDraft(raw);
      const parsed = parseNumericEntry(raw, min, max);
      setLocalError(parsed.error);
      if (parsed.error === null && Number.isFinite(parsed.value)) onChange(parsed.value);
    },
    [max, min, onChange],
  );

  const commitDraft = useCallback(() => {
    const raw = draft ?? '';
    if (raw.trim().length === 0) {
      setDraft(null);
      setLocalError(null);
      return;
    }
    const parsed = parseNumericEntry(raw, min, max);
    if (parsed.error === null) {
      setDraft(null);
      applyValue(parsed.value, true);
      return;
    }
    // Out-of-range values are clamped on commit instead of being rejected.
    if (Number.isFinite(parsed.value)) {
      setDraft(null);
      applyValue(parsed.value, true);
      return;
    }
    setLocalError(parsed.error);
  }, [applyValue, draft, max, min]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitDraft();
        inputRef.current?.select();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setDraft(null);
        setLocalError(null);
        return;
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const multiplier = event.shiftKey ? 10 : 1;
        const direction = event.key === 'ArrowUp' ? 1 : -1;
        setDraft(null);
        applyValue(value + direction * stepSize * multiplier, true);
      }
    },
    [applyValue, commitDraft, stepSize, value],
  );

  const handleScrubStart = useCallback(
    (event: ReactPointerEvent<HTMLSpanElement>) => {
      if (disabled || !Number.isFinite(min) || !Number.isFinite(max)) return;
      event.preventDefault();
      const startX = event.clientX;
      const startValue = value;
      const target = event.currentTarget.ownerDocument;
      setScrubbing(true);
      setLocalError(null);

      const move = (moveEvent: PointerEvent): void => {
        const delta = (moveEvent.clientX - startX) / Math.max(scrubSensitivity, 1);
        const raw = startValue + delta * stepSize;
        applyValue(raw, false);
      };
      const up = (): void => {
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', up);
        target.removeEventListener('pointercancel', up);
        setScrubbing(false);
        onCommit?.(clampNumber(value, min, max, value));
      };

      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', up);
      target.addEventListener('pointercancel', up);
    },
    [applyValue, disabled, max, min, onCommit, scrubSensitivity, stepSize, value],
  );

  return (
    <div className={cn('w-full', className)}>
      {label !== undefined ? (
        <label
          htmlFor={inputId}
          onPointerDown={handleScrubStart}
          onDoubleClick={() => {
            if (disabled) return;
            setDraft(null);
            setLocalError(null);
          }}
          className={cn(
            'mb-1 inline-flex touch-none items-center gap-1.5 text-[11px] font-medium tracking-wide text-zinc-400 uppercase',
            disabled ? 'cursor-not-allowed' : 'cursor-ew-resize select-none',
          )}
          title={disabled ? undefined : 'Drag to adjust · double-click to reset the pending edit'}
        >
          {label}
          {unit ? <span className="text-[10px] text-zinc-400 normal-case">{unit}</span> : null}
        </label>
      ) : null}

      <div
        className={cn(
          'flex h-9 items-center overflow-hidden rounded-[10px] border bg-obsidian-850 transition-colors duration-150',
          'focus-within:border-studio-accent/70',
          hasError ? 'border-studio-danger/70' : 'border-obsidian-700',
          scrubbing && 'border-studio-accent',
          disabled && 'opacity-50',
        )}
      >
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={`Decrease ${typeof label === 'string' ? label : 'value'}`}
          onClick={() => applyValue(value - stepSize, true)}
          className="grid h-full w-7 shrink-0 place-items-center text-zinc-400 transition-colors hover:bg-obsidian-800 hover:text-studio-accent disabled:pointer-events-none"
        >
          <Minus width={12} height={12} aria-hidden="true" />
        </button>

        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            id={inputId}
            type="number"
            inputMode="decimal"
            role="spinbutton"
            value={displayValue}
            min={Number.isFinite(min) ? min : undefined}
            max={Number.isFinite(max) ? max : undefined}
            step={stepSize}
            disabled={disabled}
            aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
            aria-invalid={hasError || undefined}
            aria-errormessage={hasError ? errorId : undefined}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={commitDraft}
            className="readout h-full w-full min-w-0 appearance-none border-x border-obsidian-700/60 bg-transparent px-2 text-center text-xs text-zinc-100 outline-none [appearance:textfield] focus-visible:outline-none disabled:cursor-not-allowed [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={`Increase ${typeof label === 'string' ? label : 'value'}`}
          onClick={() => applyValue(value + stepSize, true)}
          className="grid h-full w-7 shrink-0 place-items-center text-zinc-400 transition-colors hover:bg-obsidian-800 hover:text-studio-accent disabled:pointer-events-none"
        >
          <Plus width={12} height={12} aria-hidden="true" />
        </button>
      </div>

      {hasError ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1 flex items-center gap-1 text-[10px] text-studio-danger"
        >
          <AlertTriangle width={11} height={11} aria-hidden="true" className="shrink-0" />
          {message}
        </p>
      ) : null}
    </div>
  );
}
