'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** Secondary line rendered under the label in the popup. */
  description?: string;
  disabled?: boolean;
  icon?: LucideIcon;
}

export interface SelectProps<T extends string = string> {
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (value: T) => void;
  label?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  triggerClassName?: string;
  ariaLabel?: string;
  /** Message rendered under the control when the value is invalid. */
  error?: string | null;
}

/**
 * Headless accessible select. Implements the WAI-ARIA listbox pattern
 * (combobox trigger + `aria-activedescendant` listbox) with roving type-ahead,
 * so it behaves like a native control while staying fully themeable.
 */
export function Select<T extends string = string>({
  value,
  options,
  onChange,
  label,
  placeholder = 'Select…',
  disabled = false,
  size = 'md',
  className,
  triggerClassName,
  ariaLabel,
  error = null,
}: SelectProps<T>) {
  const listboxId = useId();
  const labelId = useId();
  const errorId = `${listboxId}-error`;
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [typeAhead, setTypeAhead] = useState('');
  const typeAheadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIndex = useMemo(() => options.findIndex((option) => option.value === value), [options, value]);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const hasError = error !== null && error !== undefined;

  const enabledIndexes = useMemo(
    () => options.map((option, index) => (option.disabled ? -1 : index)).filter((index) => index >= 0),
    [options],
  );

  const openMenu = useCallback(
    (preferredIndex?: number) => {
      if (disabled || options.length === 0) return;
      const fallback = selectedIndex >= 0 ? selectedIndex : (enabledIndexes[0] ?? 0);
      const next = preferredIndex !== undefined && !options[preferredIndex]?.disabled ? preferredIndex : fallback;
      setActiveIndex(next);
      setOpen(true);
    },
    [disabled, enabledIndexes, options, selectedIndex],
  );

  const closeMenu = useCallback((restoreFocus = true) => {
    setOpen(false);
    setTypeAhead('');
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option || option.disabled) return;
      onChange(option.value);
      closeMenu();
    },
    [closeMenu, onChange, options],
  );

  useEffect(() => {
    if (!open) return;
    const listbox = listboxRef.current;
    if (listbox) listbox.focus({ preventScroll: true });

    const handlePointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(
    () => () => {
      if (typeAheadTimer.current) clearTimeout(typeAheadTimer.current);
    },
    [],
  );

  const step = useCallback(
    (direction: 1 | -1) => {
      if (enabledIndexes.length === 0) return;
      const position = enabledIndexes.indexOf(activeIndex);
      const nextPosition =
        position === -1
          ? direction === 1
            ? 0
            : enabledIndexes.length - 1
          : (position + direction + enabledIndexes.length) % enabledIndexes.length;
      setActiveIndex(enabledIndexes[nextPosition]);
    },
    [activeIndex, enabledIndexes],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          if (!open) openMenu();
          else step(1);
          return;
        case 'ArrowUp':
          event.preventDefault();
          if (!open) openMenu();
          else step(-1);
          return;
        case 'Home':
          if (!open) return;
          event.preventDefault();
          setActiveIndex(enabledIndexes[0] ?? 0);
          return;
        case 'End':
          if (!open) return;
          event.preventDefault();
          setActiveIndex(enabledIndexes[enabledIndexes.length - 1] ?? 0);
          return;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (!open) openMenu();
          else commit(activeIndex);
          return;
        case 'Escape':
          if (!open) return;
          event.preventDefault();
          closeMenu();
          return;
        case 'Tab':
          if (open) setOpen(false);
          return;
        default:
          break;
      }

      // Type-ahead: printable characters jump to the next matching option.
      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const query = `${typeAhead}${event.key}`.toLowerCase();
        setTypeAhead(query);
        if (typeAheadTimer.current) clearTimeout(typeAheadTimer.current);
        typeAheadTimer.current = setTimeout(() => setTypeAhead(''), 600);

        const match = options.findIndex(
          (option) => !option.disabled && option.label.toLowerCase().startsWith(query),
        );
        if (match >= 0) {
          setActiveIndex(match);
          if (open) commit(match);
        }
      }
    },
    [activeIndex, closeMenu, commit, open, openMenu, options, step, typeAhead],
  );

  const triggerHeight = size === 'sm' ? 'h-8 text-xs' : 'h-10 text-sm';

  return (
    <div className={cn('w-full', className)} ref={rootRef}>
      {label !== undefined ? (
        <span
          id={labelId}
          className="mb-1.5 block text-[11px] font-medium tracking-wide text-zinc-400 uppercase"
        >
          {label}
        </span>
      ) : null}

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          id={`${listboxId}-trigger`}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-labelledby={label !== undefined ? labelId : undefined}
          aria-label={ariaLabel}
          aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
          aria-invalid={hasError || undefined}
          aria-errormessage={hasError ? errorId : undefined}
          disabled={disabled || options.length === 0}
          onClick={() => (open ? closeMenu(false) : openMenu())}
          onKeyDown={handleKeyDown}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-[10px] border bg-obsidian-850 text-left text-zinc-100',
            'transition-colors duration-150 hover:border-obsidian-600',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-accent focus-visible:ring-offset-1 focus-visible:ring-offset-obsidian-950',
            'disabled:cursor-not-allowed disabled:opacity-50',
            hasError ? 'border-studio-danger/70' : 'border-obsidian-700',
            open && 'border-studio-accent/70',
            triggerHeight,
            triggerClassName,
          )}
        >
          <span className={cn('flex min-w-0 items-center gap-2 truncate', !selected && 'text-zinc-500')}>
            {selected?.icon ? (
              <selected.icon width={14} height={14} aria-hidden="true" className="shrink-0 text-zinc-400" />
            ) : null}
            <span className="truncate">{selected?.label ?? placeholder}</span>
          </span>
          <ChevronDown
            width={14}
            height={14}
            aria-hidden="true"
            className={cn('shrink-0 text-zinc-500 transition-transform duration-200', open && 'rotate-180')}
          />
        </button>

        {open ? (
          <ul
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={label !== undefined ? labelId : undefined}
            aria-activedescendant={`${listboxId}-option-${activeIndex}`}
            onKeyDown={handleKeyDown}
            className={cn(
              'absolute top-[calc(100%+4px)] left-0 z-50 max-h-64 w-full overflow-y-auto overscroll-contain',
              'rounded-[12px] border border-obsidian-700 bg-obsidian-900/95 p-1 shadow-[var(--shadow-panel)]',
              'animate-[var(--animate-scale-in)] backdrop-blur-xl',
            )}
          >
            {options.length === 0 ? (
              <li role="presentation" className="px-3 py-6 text-center text-xs text-zinc-500">
                No options available
              </li>
            ) : (
              options.map((option, index) => {
                const isActive = index === activeIndex;
                const isSelected = option.value === value;
                const OptionIcon = option.icon;
                return (
                  <li
                    key={option.value}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    onPointerMove={() => {
                      if (!option.disabled) setActiveIndex(index);
                    }}
                    onClick={() => commit(index)}
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-xs',
                      'transition-colors duration-100',
                      option.disabled && 'cursor-not-allowed opacity-40',
                      !option.disabled && isActive && 'bg-obsidian-700/70 text-zinc-50',
                      isSelected && 'text-studio-accent',
                    )}
                  >
                    <span className="mt-0.5 w-3.5 shrink-0">
                      {isSelected ? <Check width={13} height={13} aria-hidden="true" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-medium">
                        {OptionIcon ? <OptionIcon width={12} height={12} aria-hidden="true" /> : null}
                        {option.label}
                      </span>
                      {option.description ? (
                        <span className="mt-0.5 block text-[10px] leading-snug text-zinc-500">{option.description}</span>
                      ) : null}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>

      {hasError ? (
        <p id={errorId} role="alert" className="mt-1 text-[10px] text-studio-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
