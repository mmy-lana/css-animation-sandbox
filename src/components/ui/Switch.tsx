'use client';

import { useCallback, useId, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

const TRACK_SIZE = 'h-5 w-9';
const THUMB_SIZE = 'h-3.5 w-3.5';

/**
 * Binary toggle following the WAI-ARIA switch pattern. Implemented as a real
 * `<button role="switch">` so Space/Enter activation and form participation are
 * native; the label is a click target rather than a detached `htmlFor`.
 */
export function Switch({ checked, onCheckedChange, label, description, disabled = false, className, ariaLabel }: SwitchProps) {
  const descriptionId = useId();
  const toggle = useCallback(() => {
    if (!disabled) onCheckedChange(!checked);
  }, [checked, disabled, onCheckedChange]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  return (
    <div className={cn('flex items-center justify-between gap-3', disabled && 'opacity-50', className)}>
      {label !== undefined || description !== undefined ? (
        <button
          type="button"
          disabled={disabled}
          onClick={toggle}
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-accent focus-visible:ring-offset-1 focus-visible:ring-offset-obsidian-950"
        >
          <span className="block text-[11px] font-medium tracking-wide text-zinc-300 uppercase">{label}</span>
          {description ? (
            <span id={descriptionId} className="mt-0.5 block text-[10px] leading-snug text-zinc-400">
              {description}
            </span>
          ) : null}
        </button>
      ) : (
        <span className="flex-1" />
      )}

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        data-state={checked ? 'on' : 'off'}
        className={cn(
          'relative inline-flex shrink-0 items-center rounded-full border transition-colors duration-200 ease-[var(--ease-studio)]',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-accent focus-visible:ring-offset-1 focus-visible:ring-offset-obsidian-950',
          'disabled:cursor-not-allowed',
          TRACK_SIZE,
          checked ? 'border-studio-accent/70 bg-studio-accent/25' : 'border-obsidian-700 bg-obsidian-800',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute rounded-full transition-all duration-200 ease-[var(--ease-studio)]',
            THUMB_SIZE,
            checked
              ? 'translate-x-[18px] bg-studio-accent shadow-[0_0_12px_rgba(0,245,212,0.65)]'
              : 'translate-x-[3px] bg-zinc-500',
          )}
        />
      </button>
    </div>
  );
}
