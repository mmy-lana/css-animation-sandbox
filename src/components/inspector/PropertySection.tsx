'use client';

import { useCallback, useId, useState, type ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface PropertySectionProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  /** Rendered on the header row, right of the title. */
  badge?: ReactNode;
  /** Header controls (reset buttons, toggles) that must not collapse the section. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Collapsible inspector section. The header is a real `<button>` with
 * `aria-expanded`/`aria-controls`, and the body is a labelled region, so
 * assistive technology can skip closed groups entirely.
 */
export function PropertySection({
  title,
  description,
  icon: Icon,
  defaultOpen = true,
  badge,
  actions,
  children,
  className,
}: PropertySectionProps) {
  const contentId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const toggle = useCallback(() => setOpen((previous) => !previous), []);

  return (
    <section
      className={cn('border-b border-obsidian-700/70 last:border-b-0', className)}
      data-state={open ? 'open' : 'closed'}
    >
      <div className="flex items-center gap-1.5 px-3 py-2">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={contentId}
          className={cn(
            'group flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-accent',
          )}
        >
          <ChevronDown
            width={13}
            height={13}
            aria-hidden="true"
            className={cn(
              'shrink-0 text-zinc-400 transition-transform duration-200 ease-[var(--ease-studio)]',
              open ? 'rotate-0' : '-rotate-90',
            )}
          />
          {Icon ? <Icon width={13} height={13} aria-hidden="true" className="shrink-0 text-studio-accent/80" /> : null}
          <span className="text-[11px] font-semibold tracking-[0.08em] text-zinc-300 uppercase">{title}</span>
          {badge}
        </button>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>

      {description && open ? <p className="px-3 pb-2 text-[10px] leading-snug text-zinc-400">{description}</p> : null}

      <div id={contentId} hidden={!open} className="space-y-3 px-3 pb-4">
        {open ? children : null}
      </div>
    </section>
  );
}
