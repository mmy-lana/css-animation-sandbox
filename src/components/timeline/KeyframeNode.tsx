'use client';

import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Diamond, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatMillisecondsAsSeconds } from '@/lib/cssGenerator';
import { clampNumber, type KeyframePoint } from '@/types/sandbox';

/** Offsets 0% and 100% are structural: the domain layer pins them. */
function isPinnedKeyframe(keyframe: KeyframePoint): boolean {
  return keyframe.offset === 0 || keyframe.offset === 100;
}

export interface KeyframeNodeProps {
  keyframe: KeyframePoint;
  durationMs: number;
  isActive: boolean;
  isSelected: boolean;
  onSelect: (keyframeId: string) => void;
  /**
   * Fired continuously while dragging. `commit` is true on release, which is
   * the signal to close a history entry.
   */
  onOffsetChange: (keyframeId: string, offset: number, commit: boolean) => void;
  onDelete?: (keyframeId: string) => void;
  disabled?: boolean;
  className?: string;
}

const TOUCH_TARGET_PX = 44;

/**
 * Draggable keyframe marker.
 *
 * The 44px hit area is transparent and larger than the visual diamond, which
 * keeps the timeline readable on touch screens. Dragging uses pointer capture
 * so the gesture survives leaving the element, and the offset is derived from
 * the parent track width so it is resolution independent.
 */
export function KeyframeNode({
  keyframe,
  durationMs,
  isActive,
  isSelected,
  onSelect,
  onOffsetChange,
  onDelete,
  disabled = false,
  className,
}: KeyframeNodeProps) {
  const nodeRef = useRef<HTMLButtonElement>(null);
  const dragStateRef = useRef<{ pointerId: number; startOffset: number; trackWidth: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const pinned = isPinnedKeyframe(keyframe);

  const trackWidth = useCallback((): number => {
    const parent = nodeRef.current?.parentElement;
    return parent ? parent.getBoundingClientRect().width : 0;
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      event.stopPropagation();
      onSelect(keyframe.id);
      if (pinned || event.button !== 0) return;
      const width = trackWidth();
      if (width <= 0) return;
      dragStateRef.current = { pointerId: event.pointerId, startOffset: keyframe.offset, trackWidth: width };
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [disabled, keyframe.id, keyframe.offset, onSelect, pinned, trackWidth],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const parent = nodeRef.current?.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const deltaPercent = ((event.clientX - rect.left - (drag.trackWidth * drag.startOffset) / 100) / rect.width) * 100;
      const next = clampNumber(
        Math.round((drag.startOffset + deltaPercent) * 10) / 10,
        0,
        100,
        drag.startOffset,
      );
      onOffsetChange(keyframe.id, next, false);
    },
    [keyframe.id, onOffsetChange],
  );

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragStateRef.current = null;
      setDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      onOffsetChange(keyframe.id, keyframe.offset, true);
    },
    [keyframe.id, keyframe.offset, onOffsetChange],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      const step = event.shiftKey ? 10 : 1;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (onDelete && !pinned) {
          event.preventDefault();
          onDelete(keyframe.id);
        }
        return;
      }
      if (pinned) return;
      let next: number | null = null;
      if (event.key === 'ArrowLeft') next = keyframe.offset - step;
      if (event.key === 'ArrowRight') next = keyframe.offset + step;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = 100;
      if (next === null) return;
      event.preventDefault();
      onOffsetChange(keyframe.id, clampNumber(next, 0, 100, keyframe.offset), true);
    },
    [disabled, keyframe.id, keyframe.offset, onDelete, onOffsetChange, pinned],
  );

  const timeLabel = formatMillisecondsAsSeconds((keyframe.offset / 100) * durationMs);

  return (
    <button
      ref={nodeRef}
      type="button"
      role="button"
      aria-pressed={isSelected}
      aria-label={`Keyframe at ${keyframe.offset}% (${timeLabel}s)${pinned ? ', pinned endpoint' : ''}`}
      aria-valuetext={`${keyframe.offset}%`}
      disabled={disabled}
      data-keyframe-id={keyframe.id}
      data-pinned={pinned || undefined}
      data-dragging={dragging || undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(keyframe.id);
      }}
      style={{ left: `${keyframe.offset}%` }}
      className={cn(
        'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 touch-none select-none',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-accent focus-visible:ring-offset-1 focus-visible:ring-offset-obsidian-950',
        'disabled:pointer-events-none disabled:opacity-50',
        pinned ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none flex items-center justify-center"
        style={{ width: TOUCH_TARGET_PX, height: TOUCH_TARGET_PX }}
      >
        <span
          className={cn(
            'grid h-5 w-5 place-items-center transition-all duration-150 ease-[var(--ease-studio)]',
            isSelected
              ? 'scale-110 text-studio-accent drop-shadow-[0_0_8px_rgba(0,245,212,0.6)]'
              : isActive
                ? 'text-studio-violet-soft'
                : 'text-zinc-500 hover:text-zinc-200',
          )}
        >
          {pinned ? (
            <Lock width={15} height={15} strokeWidth={2.2} />
          ) : (
            <Diamond width={15} height={15} fill="currentColor" strokeWidth={1.5} />
          )}
        </span>
        {isSelected ? (
          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded bg-obsidian-950/90 px-1 text-[9px] text-studio-accent readout">
            {keyframe.offset}% · {timeLabel}s
          </span>
        ) : null}
      </span>
    </button>
  );
}
