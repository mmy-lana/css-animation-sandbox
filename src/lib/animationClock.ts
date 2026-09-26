/**
 * Playback clock math shared by the animation engine, the timeline scrubber and
 * the code generators.
 *
 * Every function here is pure and total: invalid input clamps instead of
 * producing `NaN`, so the UI can never render a broken timecode. Direction is
 * honoured when mapping a time onto the *current iteration*, which is what the
 * playhead shows — a `reverse` timeline therefore reports 100% → 0% while the
 * native `Animation` plays forward in time.
 */

import type { AnimationDirection, AnimationIteration } from '@/types/sandbox';

export interface IterationClock {
  durationMs: number;
  delayMs: number;
  /** `Infinity` is allowed and is never coerced to a finite number. */
  iterations: number;
  direction: AnimationDirection;
  /** Playback rate multiplier applied to the duration. */
  speed: number;
}

const MIN_SPEED = 0.1;
const MAX_SPEED = 4;

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

/** Normalizes an {@link AnimationIteration} into a number, keeping infinity. */
export function resolveIterationCount(iterations: AnimationIteration | number): number {
  if (iterations === 'infinite' || iterations === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
  const numeric = finite(iterations, 1);
  return Math.max(1, Math.floor(numeric));
}

/** Number of iterations actually run before the animation ends. */
export function iterationCount(clock: IterationClock): number {
  return resolveIterationCount(clock.iterations);
}

/** Active duration of a single iteration, ignoring speed. */
export function iterationDurationMs(clock: IterationClock): number {
  return Math.max(0, finite(clock.durationMs, 0));
}

/** Active duration across every iteration (`Infinity` stays infinite). */
export function totalActiveDurationMs(clock: IterationClock): number {
  const perIteration = iterationDurationMs(clock);
  const count = iterationCount(clock);
  return Number.isFinite(count) ? perIteration * count : Number.POSITIVE_INFINITY;
}

/** Wall-clock duration at the current speed, used for the UI readout. */
export function effectiveDurationMs(clock: IterationClock): number {
  const speed = Math.min(Math.max(finite(clock.speed, 1), MIN_SPEED), MAX_SPEED);
  return speed > 0 ? iterationDurationMs(clock) / speed : iterationDurationMs(clock);
}

/** True while the playhead is still inside the animation's delay. */
export function isWithinDelay(currentTimeMs: number, clock: IterationClock): boolean {
  return finite(currentTimeMs, 0) < Math.max(0, finite(clock.delayMs, 0));
}

/** Playback direction of a given zero-based iteration index. */
export function isIterationReversed(direction: AnimationDirection, index: number): boolean {
  switch (direction) {
    case 'reverse':
      return true;
    case 'alternate':
      return index % 2 === 1;
    case 'alternate-reverse':
      return index % 2 === 0;
    case 'normal':
    default:
      return false;
  }
}

/**
 * Maps an absolute time onto 0…1 progress inside the iteration that is playing.
 * The result accounts for delay, iteration count and direction, and is clamped
 * at both ends.
 */
export function currentTimeToProgress(currentTimeMs: number, clock: IterationClock): number {
  const duration = iterationDurationMs(clock);
  if (duration <= 0) return 0;

  const delay = Math.max(0, finite(clock.delayMs, 0));
  const local = finite(currentTimeMs, 0) - delay;
  if (local <= 0) return 0;

  const total = totalActiveDurationMs(clock);
  const count = iterationCount(clock);
  const clamped = Number.isFinite(total) ? Math.min(local, total) : local;
  let index = Math.floor(clamped / duration);
  let withinIteration = clamped - index * duration;
  // At the very end of a finite animation the division lands one iteration
  // past the last frame: pin it to the end of the final iteration instead.
  if (Number.isFinite(count) && index >= count) {
    index = count - 1;
    withinIteration = duration;
  }
  const progress = Math.min(Math.max(withinIteration / duration, 0), 1);

  return isIterationReversed(clock.direction, index) ? 1 - progress : progress;
}

/** Inverse of {@link currentTimeToProgress} for the iteration the user is on. */
export function progressToCurrentTime(progress: number, clock: IterationClock): number {
  const duration = iterationDurationMs(clock);
  if (duration <= 0) return Math.max(0, finite(clock.delayMs, 0));

  const safeProgress = Math.min(Math.max(finite(progress, 0), 0), 1);
  const directed = isIterationReversed(clock.direction, 0) ? 1 - safeProgress : safeProgress;
  return Math.max(0, finite(clock.delayMs, 0)) + directed * duration;
}

/** `currentTimeToProgress` in the 0…100 form used by the timeline. */
export function currentTimeToPercent(currentTimeMs: number, clock: IterationClock): number {
  return currentTimeToProgress(currentTimeMs, clock) * 100;
}

/** `progressToCurrentTime` from a 0…100 playhead position. */
export function percentToCurrentTime(percent: number, clock: IterationClock): number {
  return progressToCurrentTime(percent / 100, clock);
}

/** True once a finite animation has played every iteration. */
export function isFinished(currentTimeMs: number, clock: IterationClock): boolean {
  const total = totalActiveDurationMs(clock);
  if (!Number.isFinite(total) || total <= 0) return false;
  return finite(currentTimeMs, 0) - Math.max(0, finite(clock.delayMs, 0)) >= total;
}

/** Builds a clock from a timeline-shaped input plus the live speed multiplier. */
export function createIterationClock(
  timeline: { durationMs: number; delayMs: number; iterationCount: AnimationIteration; direction: AnimationDirection },
  speed = 1,
): IterationClock {
  return {
    durationMs: timeline.durationMs,
    delayMs: timeline.delayMs,
    iterations: resolveIterationCount(timeline.iterationCount),
    direction: timeline.direction,
    speed,
  };
}
