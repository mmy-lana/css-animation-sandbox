'use client';

import { cn } from '@/lib/cn';
import { TIMELINE_LIMITS, clampNumber } from '@/types/sandbox';

export interface PlayheadProps {
  /** Position within the track, 0…100. */
  offsetPercent: number;
  /** Milliseconds the playhead currently represents, shown for screen readers. */
  currentTimeMs?: number;
  /** Timecode shown inside the head badge. */
  timecode?: string;
  /** True while the user is dragging, which highlights the line. */
  isActive?: boolean;
  /** Renders the focusable slider role and the grab area. */
  interactive?: boolean;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  className?: string;
}

/**
 * Vertical playhead overlay.
 *
 * The line is positioned with a percentage so it tracks the track width at any
 * breakpoint without measuring, and it carries the `role="slider"` semantics so
 * the playhead is reachable from the keyboard — the track itself owns the
 * pointer handlers and this node only mirrors the position.
 */
export function Playhead({
  offsetPercent,
  currentTimeMs,
  timecode,
  isActive = false,
  interactive = true,
  onPointerDown,
  onKeyDown,
  className,
}: PlayheadProps) {
  const position = clampNumber(offsetPercent, TIMELINE_LIMITS.offset.min, TIMELINE_LIMITS.offset.max, 0);

  return (
    <div
      className={cn('pointer-events-none absolute inset-y-0 z-30', className)}
      style={{ left: `${position}%` }}
      aria-hidden={!interactive}
    >
      <div
        className={cn(
          'absolute inset-y-0 -left-px w-0.5 bg-studio-accent transition-opacity duration-150',
          isActive ? 'opacity-100' : 'opacity-80',
        )}
      />
      <div
        className={cn(
          'absolute -top-px left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] border border-studio-accent bg-obsidian-900 transition-transform duration-150',
          isActive && 'scale-125',
        )}
      />
      {interactive ? (
        <div
          role="slider"
          tabIndex={0}
          aria-label="Playhead position"
          aria-orientation="horizontal"
          aria-valuemin={TIMELINE_LIMITS.offset.min}
          aria-valuemax={TIMELINE_LIMITS.offset.max}
          aria-valuenow={Math.round(position * 10) / 10}
          aria-valuetext={timecode}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
          className="pointer-events-auto absolute -left-5 -top-1 h-8 w-10 cursor-ew-resize rounded focus-visible:ring-1 focus-visible:ring-studio-accent"
        />
      ) : null}
      {timecode ? (
        <span className="readout absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-studio-accent px-1.5 py-0.5 text-[9px] font-medium whitespace-nowrap text-obsidian-950">
          {timecode}
          {currentTimeMs !== undefined ? <span className="sr-only">, {Math.round(currentTimeMs)} milliseconds</span> : null}
        </span>
      ) : null}
    </div>
  );
}
