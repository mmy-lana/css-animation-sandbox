'use client';

import { cloneElement, useCallback, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: ReactNode;
  /** Single focusable element that owns the tooltip. */
  children: ReactElement<{
    'aria-describedby'?: string;
    onMouseEnter?: (event: React.MouseEvent<HTMLElement>) => void;
    onMouseLeave?: (event: React.MouseEvent<HTMLElement>) => void;
    onFocus?: (event: React.FocusEvent<HTMLElement>) => void;
    onBlur?: (event: React.FocusEvent<HTMLElement>) => void;
  }>;
  side?: TooltipSide;
  delayMs?: number;
  disabled?: boolean;
  className?: string;
}

const SIDE_STYLES: Readonly<Record<TooltipSide, string>> = {
  top: 'bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2',
  bottom: 'top-[calc(100%+6px)] left-1/2 -translate-x-1/2',
  left: 'right-[calc(100%+6px)] top-1/2 -translate-y-1/2',
  right: 'left-[calc(100%+6px)] top-1/2 -translate-y-1/2',
};

/**
 * Hover/focus tooltip. The bubble is wired to the trigger with
 * `aria-describedby`, so screen readers announce it on focus; hover is purely
 * additive and the trigger is not wrapped in an extra DOM node.
 */
export function Tooltip({ content, children, side = 'top', delayMs = 350, disabled = false, className }: TooltipProps) {
  const tooltipId = useId();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(
    (immediate = false) => {
      if (disabled) return;
      clearTimer();
      if (immediate || delayMs <= 0) setVisible(true);
      else timerRef.current = setTimeout(() => setVisible(true), delayMs);
    },
    [clearTimer, delayMs, disabled],
  );

  const hide = useCallback(() => {
    clearTimer();
    setVisible(false);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  const trigger = cloneElement(children, {
    'aria-describedby': visible && !disabled ? tooltipId : undefined,
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
      children.props.onMouseEnter?.(event);
      show();
    },
    onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
      children.props.onMouseLeave?.(event);
      hide();
    },
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      children.props.onFocus?.(event);
      show(true);
    },
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      children.props.onBlur?.(event);
      hide();
    },
  });

  return (
    <span className="relative inline-flex">
      {trigger}
      {visible && !disabled ? (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-[90] max-w-[16rem] animate-[var(--animate-scale-in)] rounded-lg border border-obsidian-700',
            'bg-obsidian-900/95 px-2 py-1 text-[10px] leading-snug whitespace-normal text-zinc-200 shadow-[var(--shadow-panel)] backdrop-blur-md',
            SIDE_STYLES[side],
            className,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
