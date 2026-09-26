'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'type'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Strict SVG icon rendered before the label. */
  iconLeft?: LucideIcon;
  /** Strict SVG icon rendered after the label. */
  iconRight?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
  /** Accessible name for icon-only usage. */
  ariaLabel?: string;
  children?: ReactNode;
  type?: 'button' | 'submit' | 'reset';
}

const VARIANT_STYLES: Readonly<Record<ButtonVariant, string>> = {
  primary:
    'bg-studio-accent/90 text-obsidian-950 border border-studio-accent/60 hover:bg-studio-accent active:bg-studio-accent/80 shadow-[0_10px_30px_-16px_rgba(0,245,212,0.9)]',
  secondary:
    'bg-obsidian-800 text-zinc-100 border border-obsidian-700 hover:border-obsidian-600 hover:bg-obsidian-700/70 active:bg-obsidian-700',
  outline:
    'bg-transparent text-zinc-200 border border-obsidian-600 hover:border-studio-accent/60 hover:text-studio-accent active:bg-studio-accent/5',
  ghost:
    'bg-transparent text-zinc-400 border border-transparent hover:bg-obsidian-800 hover:text-zinc-100 active:bg-obsidian-700/60',
  danger:
    'bg-studio-danger/90 text-white border border-studio-danger/60 hover:bg-studio-danger active:bg-studio-danger/80 shadow-[0_10px_30px_-16px_rgba(244,63,94,0.9)]',
};

const SIZE_STYLES: Readonly<Record<ButtonSize, string>> = {
  xs: 'h-7 gap-1 px-2 text-[11px] rounded-md',
  sm: 'h-8 gap-1.5 px-3 text-xs rounded-md',
  md: 'h-10 gap-2 px-4 text-sm rounded-[10px]',
  lg: 'h-12 gap-2 px-6 text-base rounded-[12px]',
  icon: 'h-10 w-10 rounded-[10px]',
  'icon-sm': 'h-8 w-8 rounded-md',
};

const ICON_SIZES: Readonly<Record<ButtonSize, number>> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  icon: 18,
  'icon-sm': 14,
};

/**
 * Primary interactive control. Uses a real `<button>`, so keyboard activation,
 * focus order and form semantics are native; the `focus-visible` ring follows
 * the studio contract (1px cyan ring with an obsidian offset).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    iconLeft: IconLeft,
    iconRight: IconRight,
    loading = false,
    fullWidth = false,
    ariaLabel,
    className,
    disabled,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled === true || loading;
  const iconSize = ICON_SIZES[size];

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium',
        'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[var(--ease-studio)]',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-accent focus-visible:ring-offset-1 focus-visible:ring-offset-obsidian-950',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2
          className="animate-[var(--animate-spin-slow)]"
          width={iconSize}
          height={iconSize}
          aria-hidden="true"
        />
      ) : IconLeft ? (
        <IconLeft width={iconSize} height={iconSize} aria-hidden="true" className="shrink-0" />
      ) : null}
      {children}
      {IconRight && !loading ? (
        <IconRight width={iconSize} height={iconSize} aria-hidden="true" className="shrink-0" />
      ) : null}
    </button>
  );
});
