'use client';

import { useCallback, useMemo, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/cn';
import { formatMillisecondsAsSeconds } from '@/lib/cssGenerator';
import { TIMELINE_LIMITS, clampNumber } from '@/types/sandbox';

export interface TrackRulerProps {
  durationMs: number;
  /** Playhead position in percent (0…100). */
  offsetPercent: number;
  onSeek: (offsetPercent: number, commit: boolean) => void;
  /** Renders the delay window as a hatched region. */
  delayMs?: number;
  disabled?: boolean;
  /**
   * Drops the slider role, tab stop and pointer handling so a larger surface
   * (the timeline track) can own seeking without duplicating the a11y tree.
   */
  presentational?: boolean;
  className?: string;
}

const TICK_STEP = 10;
const LABEL_STEP = 25;
const MINOR_TICK_HEIGHT = 4;
const MAJOR_TICK_HEIGHT = 9;

/**
 * Time ruler for the timeline track. Ticks are laid out in percent (not
 * pixels), so the ruler stays exact at any container size; pointer input maps
 * a client X back into 0…100% and commits on release, while arrow keys nudge by
 * one step for keyboard-only seeking.
 */
export function TrackRuler({
  durationMs,
  offsetPercent,
  onSeek,
  delayMs = 0,
  disabled = false,
  presentational = false,
  className,
}: TrackRulerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const duration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 1;
  const ticks = useMemo(() => {
    const values: number[] = [];
    for (let percent = 0; percent <= 100; percent += TICK_STEP) values.push(percent);
    return values;
  }, []);

  const percentFromClientX = useCallback(
    (clientX: number): number => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return 0;
      const ratio = (clientX - rect.left) / rect.width;
      return clampNumber(
        Math.round(ratio * 1000) / 10,
        TIMELINE_LIMITS.offset.min,
        TIMELINE_LIMITS.offset.max,
        0,
      );
    },
    [],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      event.preventDefault();
      draggingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      onSeek(percentFromClientX(event.clientX), false);
    },
    [disabled, onSeek, percentFromClientX],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled || !draggingRef.current) return;
      onSeek(percentFromClientX(event.clientX), false);
    },
    [disabled, onSeek, percentFromClientX],
  );

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      onSeek(percentFromClientX(event.clientX), true);
    },
    [onSeek, percentFromClientX],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      const step = event.shiftKey ? 10 : 1;
      let next: number | null = null;
      if (event.key === 'ArrowLeft') next = offsetPercent - step;
      if (event.key === 'ArrowRight') next = offsetPercent + step;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = 100;
      if (next === null) return;
      event.preventDefault();
      onSeek(
        clampNumber(Math.round(next * 10) / 10, TIMELINE_LIMITS.offset.min, TIMELINE_LIMITS.offset.max, 0),
        true,
      );
    },
    [disabled, offsetPercent, onSeek],
  );

  const delayPercent = duration > 0 ? clampNumber((delayMs / duration) * 100, 0, 100, 0) : 0;
  const progressPercent = clampNumber(offsetPercent, 0, 100, 0);

  return (
    <div className={cn('select-none', disabled && 'pointer-events-none opacity-50', className)}>
      <div
        ref={trackRef}
        role={presentational ? undefined : 'slider'}
        tabIndex={presentational || disabled ? -1 : 0}
        aria-label={presentational ? undefined : 'Timeline position'}
        aria-valuemin={presentational ? undefined : 0}
        aria-valuemax={presentational ? undefined : 100}
        aria-valuenow={presentational ? undefined : Math.round(progressPercent * 10) / 10}
        aria-valuetext={
          presentational
            ? undefined
            : `${Math.round(progressPercent)}% · ${formatMillisecondsAsSeconds((progressPercent / 100) * duration)}`
        }
        aria-disabled={presentational ? undefined : disabled || undefined}
        onPointerDown={presentational ? undefined : handlePointerDown}
        onPointerMove={presentational ? undefined : handlePointerMove}
        onPointerUp={presentational ? undefined : endDrag}
        onPointerCancel={presentational ? undefined : endDrag}
        onKeyDown={presentational ? undefined : handleKeyDown}
        className={cn(
          'relative h-7 rounded-md border border-obsidian-700/70 bg-obsidian-850/80',
          presentational ? 'pointer-events-none' : 'cursor-ew-resize touch-none',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-accent',
        )}
      >
        {delayPercent > 0 ? (
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 border-r border-dashed border-studio-violet-soft/50 bg-studio-violet/10"
            style={{ width: `${delayPercent}%` }}
            title={`Delay ${formatMillisecondsAsSeconds(delayMs)}`}
          />
        ) : null}

        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {ticks.map((percent) => {
            const isMajor = percent % LABEL_STEP === 0;
            return (
              <div
                key={percent}
                className="absolute bottom-0 flex flex-col items-center"
                style={{ left: `${percent}%`, transform: percent === 0 ? 'none' : 'translateX(-50%)' }}
              >
                {isMajor ? (
                  <span className="readout mb-0.5 -translate-x-1/2 text-[9px] leading-none text-zinc-400">
                    {formatMillisecondsAsSeconds((percent / 100) * duration)}
                  </span>
                ) : null}
                <span
                  className={cn('w-px', isMajor ? 'bg-zinc-600' : 'bg-obsidian-600')}
                  style={{ height: isMajor ? MAJOR_TICK_HEIGHT : MINOR_TICK_HEIGHT }}
                />
              </div>
            );
          })}
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 bg-studio-accent/8"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
