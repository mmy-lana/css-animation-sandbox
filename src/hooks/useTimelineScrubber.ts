'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import {
  percentageToProgressRatio,
  formatTimecode,
  formatMillisecondsAsSeconds,
} from '@/lib/cssGenerator';
import { createIterationClock, percentToCurrentTime } from '@/lib/animationClock';
import { TIMELINE_LIMITS, clampNumber } from '@/types/sandbox';

export interface UseTimelineScrubberOptions {
  durationMs: number;
  delayMs?: number;
  /**
   * Receives every accepted offset. `commit` is true on pointer release and on
   * keyboard steps, which is the signal to close a history entry.
   */
  onScrub: (offsetPercent: number, commit: boolean) => void;
  /** Playhead owned by the animation engine; `null` while the engine is idle. */
  externalOffsetPercent?: number | null;
  /** Percentage nudged by an arrow key. Defaults to 1. */
  keyboardStep?: number;
  disabled?: boolean;
}

export interface TimelineScrubber {
  /** Playhead in 0…100, kept fractional (not snapped to whole percent). */
  offsetPercent: number;
  /** Playhead as a 0…1 ratio, for the WAAPI scrub path. */
  progressRatio: number;
  currentTimeMs: number;
  /** `m:ss.mmm` readout. */
  timecode: string;
  /** Duration formatted as seconds, for the ruler labels. */
  durationLabel: string;
  /** Delay window of the timeline, in milliseconds. */
  delayMs: number;
  isScrubbing: boolean;
  /** Attach to the element the pointer positions are measured against. */
  trackRef: RefObject<HTMLDivElement | null>;
  /** Converts a client X into a clamped 0…100 offset using the track rect. */
  offsetFromClientX: (clientX: number) => number;
  handlePointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  handlePointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  handlePointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  handleKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  /** Sets the playhead; `commit` is forwarded to {@link onScrub}. */
  setOffsetPercent: (percent: number, commit?: boolean) => void;
  /** Seeks by absolute time, clamped into `[0, durationMs]`. */
  seekToTimeMs: (milliseconds: number) => void;
  /** Relative keyboard-style nudge in percent. */
  nudge: (deltaPercent: number) => void;
}

function toRect(rect: DOMRect | null | undefined): DOMRect | null {
  if (!rect || typeof rect.width !== 'number' || typeof rect.left !== 'number') return null;
  return rect;
}

/**
 * Playhead state for the timeline.
 *
 * Pointer moves are coalesced into a single `requestAnimationFrame` tick so a
 * 120Hz pointer stream cannot outrun React's render cadence, and the final
 * position is applied synchronously on release. The hook owns the offset — the
 * ruler, the scrub bar and the stage all read the same value, and an external
 * source (the playback engine) can drive it without a feedback loop.
 */
export function useTimelineScrubber({
  durationMs,
  delayMs = 0,
  onScrub,
  externalOffsetPercent = null,
  keyboardStep = 1,
  disabled = false,
}: UseTimelineScrubberOptions): TimelineScrubber {
  const safeDuration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
  const [offsetPercent, setOffsetPercentState] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const onScrubRef = useRef(onScrub);
  onScrubRef.current = onScrub;

  offsetRef.current = offsetPercent;

  const clamp = useCallback(
    (value: number): number =>
      clampNumber(
        Math.round(value * 10) / 10,
        TIMELINE_LIMITS.offset.min,
        TIMELINE_LIMITS.offset.max,
        0,
      ),
    [],
  );

  const cancelPendingFrame = useCallback(() => {
    if (frameRef.current !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = null;
    pendingRef.current = null;
  }, []);

  // External drive (playback engine): mirror without echoing back to the host.
  useEffect(() => {
    if (externalOffsetPercent === null) return;
    const next = clamp(externalOffsetPercent);
    cancelPendingFrame();
    if (next === offsetRef.current) return;
    offsetRef.current = next;
    setOffsetPercentState(next);
  }, [cancelPendingFrame, clamp, externalOffsetPercent]);

  useEffect(() => cancelPendingFrame, [cancelPendingFrame]);

  const setOffsetPercent = useCallback(
    (percent: number, commit = false) => {
      if (disabled) return;
      const next = clamp(percent);
      if (commit) cancelPendingFrame();
      offsetRef.current = next;
      setOffsetPercentState(next);
      onScrubRef.current(next, commit);
    },
    [cancelPendingFrame, clamp, disabled],
  );

  const scheduleOffset = useCallback(
    (percent: number) => {
      if (disabled) return;
      const next = clamp(percent);
      pendingRef.current = next;
      if (frameRef.current !== null) return;
      const flush = (): void => {
        frameRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending === null || disabled) return;
        offsetRef.current = pending;
        setOffsetPercentState(pending);
        onScrubRef.current(pending, false);
      };
      frameRef.current =
        typeof requestAnimationFrame === 'function' ? requestAnimationFrame(flush) : (setTimeout(flush, 16) as unknown as number);
    },
    [clamp, disabled],
  );

  const offsetFromClientX = useCallback(
    (clientX: number): number => {
      const rect = toRect(trackRef.current?.getBoundingClientRect());
      if (!rect || rect.width === 0) return offsetRef.current;
      return clamp(((clientX - rect.left) / rect.width) * 100);
    },
    [clamp],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled) return;
      event.preventDefault();
      setIsScrubbing(true);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort; the move handler still tracks the pointer.
      }
      scheduleOffset(offsetFromClientX(event.clientX));
    },
    [disabled, offsetFromClientX, scheduleOffset],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled || !isScrubbing) return;
      scheduleOffset(offsetFromClientX(event.clientX));
    },
    [disabled, isScrubbing, offsetFromClientX, scheduleOffset],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!isScrubbing) return;
      setIsScrubbing(false);
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Ignore: the capture may already have been lost.
      }
      // Applied synchronously so the committed offset never lags one frame.
      setOffsetPercent(offsetFromClientX(event.clientX), true);
    },
    [isScrubbing, offsetFromClientX, setOffsetPercent],
  );

  const nudge = useCallback(
    (deltaPercent: number) => {
      setOffsetPercent(offsetRef.current + deltaPercent, true);
    },
    [setOffsetPercent],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (disabled) return;
      const step = event.shiftKey ? keyboardStep * 5 : keyboardStep;
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          nudge(-step);
          break;
        case 'ArrowRight':
          event.preventDefault();
          nudge(step);
          break;
        case 'Home':
          event.preventDefault();
          setOffsetPercent(0, true);
          break;
        case 'End':
          event.preventDefault();
          setOffsetPercent(100, true);
          break;
        default:
          break;
      }
    },
    [disabled, keyboardStep, nudge, setOffsetPercent],
  );

  const seekToTimeMs = useCallback(
    (milliseconds: number) => {
      if (safeDuration <= 0) return;
      setOffsetPercent(((milliseconds - Math.max(0, delayMs)) / safeDuration) * 100, true);
    },
    [delayMs, safeDuration, setOffsetPercent],
  );

  // Delay-aware playhead clock, shared with the playback engine so the
  // timecode on the timeline always matches the stage.
  const clock = useMemo(
    () => createIterationClock({ durationMs: safeDuration, delayMs, iterationCount: 1, direction: 'normal' }),
    [delayMs, safeDuration],
  );
  const currentTimeMs = percentToCurrentTime(offsetPercent, clock);

  return useMemo(
    () => ({
      offsetPercent,
      progressRatio: percentageToProgressRatio(offsetPercent),
      currentTimeMs,
      timecode: formatTimecode(currentTimeMs),
      durationLabel: formatMillisecondsAsSeconds(safeDuration),
      isScrubbing,
      trackRef,
      offsetFromClientX,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      handleKeyDown,
      setOffsetPercent,
      seekToTimeMs,
      nudge,
      delayMs,
    }),
    [
      currentTimeMs,
      delayMs,
      handleKeyDown,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      isScrubbing,
      nudge,
      offsetFromClientX,
      offsetPercent,
      safeDuration,
      seekToTimeMs,
      setOffsetPercent,
    ],
  );
}
