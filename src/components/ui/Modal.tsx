'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  /** Disables backdrop-click dismissal for destructive confirmations. */
  dismissible?: boolean;
  closeOnEscape?: boolean;
  className?: string;
}

const SIZE_STYLES: Readonly<Record<ModalSize, string>> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Portal-rendered dialog with a blurred backdrop. Implements the WAI-ARIA modal
 * pattern: `aria-modal`, focus moved into the dialog on open, Tab cycles inside
 * it, and focus returns to the trigger on close. Body scroll is locked while
 * open and always restored, including on unmount.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
  closeOnEscape = true,
  className,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = `${titleId}-description`;
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;

    restoreFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusables?.[0] ?? panel)?.focus({ preventScroll: true });

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
      restoreFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape' && closeOnEscape) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [closeOnEscape, onClose],
  );

  if (!open || !mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 animate-[var(--animate-fade-rise)] bg-obsidian-950/75 backdrop-blur-md"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[16px] border border-obsidian-700 bg-obsidian-900/95 shadow-[var(--shadow-panel)]',
          'animate-[var(--animate-scale-in)] backdrop-blur-xl sm:rounded-[16px]',
          SIZE_STYLES[size],
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-obsidian-700/80 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-truncate-tight text-sm font-semibold text-zinc-100">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-xs leading-relaxed text-zinc-400">
                {description}
              </p>
            ) : null}
          </div>
          {dismissible ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-obsidian-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-accent"
            >
              <X width={15} height={15} aria-hidden="true" />
            </button>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-obsidian-700/80 bg-obsidian-950/40 px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
