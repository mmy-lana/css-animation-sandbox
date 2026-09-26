'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  applyScrubToDOMNode,
  cancelScrubAnimations,
  createCanonicalWaapiAnimation,
  trackScrubAnimation,
} from '@/lib/cssGenerator';
import {
  createIterationClock,
  currentTimeToPercent,
  effectiveDurationMs,
  isFinished,
  iterationCount,
  iterationDurationMs,
  percentToCurrentTime,
  totalActiveDurationMs,
  type IterationClock,
} from '@/lib/animationClock';
import type { AnimationTimeline } from '@/types/sandbox';

export interface UseAnimationEngineOptions {
  /** Timeline supplying duration, delay, iterations, direction and fill mode. */
  timeline: AnimationTimeline;
  /** Node driven by the Web Animations API during playback. */
  targetRef: RefObject<HTMLElement | null>;
  /** Receives the playhead in 0…100, measured within a single iteration. */
  onProgress?: (offsetPercent: number) => void;
  /** Initial playback rate multiplier. Defaults to 1. */
  defaultSpeed?: number;
  /** Forces infinite playback regardless of `timeline.iterationCount`. */
  loop?: boolean;
  /** When false the engine reports progress without touching the node. */
  driveNode?: boolean;
}

export interface AnimationEngine {
  isPlaying: boolean;
  /** True when the platform can drive the node through the WAAPI. */
  isSupported: boolean;
  /** True when a virtual clock is used because the WAAPI path is unavailable. */
  isClockFallback: boolean;
  /** A timeline needs two keyframes and a positive duration before it can play. */
  canPlay: boolean;
  speed: number;
  setSpeed: (speed: number) => void;
  loop: boolean;
  setLoop: (loop: boolean) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  stop: () => void;
  /** Steps by animation frames (1/60s of the timeline duration) and pauses. */
  stepFrames: (frames: number) => void;
  /** Jumps the playhead (0…1 within an iteration) and pauses. */
  seekRatio: (ratio: number) => void;
  /** Playhead as a percentage within the current iteration. */
  progressPercent: number;
  /** Playhead in milliseconds, delay included. */
  currentTimeMs: number;
  /** Wall-clock duration at the current speed, for the UI readout. */
  effectiveDurationMs: number;
  /** True once a finite animation has run every iteration. */
  isFinished: boolean;
}

interface EngineSettings {
  clock: IterationClock;
  speed: number;
  canPlay: boolean;
}

const FRAME_DIVISOR = 60;
const MIN_SPEED = 0.1;
const MAX_SPEED = 4;

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

function requestTick(callback: () => void): number {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(() => callback());
  return setTimeout(callback, 16) as unknown as number;
}

function cancelTick(handle: number | null): void {
  if (handle === null) return;
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
  else clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
}

/**
 * Playback engine.
 *
 * Playback is delegated to one native `Animation` produced by
 * `createCanonicalWaapiAnimation`, so delay, iterations, direction and fill
 * behave exactly as the exported CSS will, and `playbackRate` provides duration
 * scaling without recomputing the effect. A `requestAnimationFrame` monitor only
 * *reads* `currentTime` to publish the playhead, so the engine never fights the
 * compositor.
 *
 * When `Element.animate` is unavailable — or the target has not mounted yet —
 * the hook falls back to a virtual clock, and the stage keeps rendering the same
 * keyframes through React state, so playback never silently does nothing.
 */
export function useAnimationEngine({
  timeline,
  targetRef,
  onProgress,
  defaultSpeed = 1,
  loop = false,
  driveNode = true,
}: UseAnimationEngineOptions): AnimationEngine {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [speed, setSpeedState] = useState(() => clamp(defaultSpeed, MIN_SPEED, MAX_SPEED, 1));
  const [isLooping, setIsLooping] = useState(loop);
  const [isClockFallback, setIsClockFallback] = useState(false);

  const animationRef = useRef<Animation | null>(null);
  const frameRef = useRef<number | null>(null);
  const clockStartRef = useRef(0);
  const virtualRatioRef = useRef(0);
  const progressRef = useRef(0);
  const onProgressRef = useRef(onProgress);
  const timelineRef = useRef(timeline);

  onProgressRef.current = onProgress;
  timelineRef.current = timeline;

  // Everything the RAF monitor reads lives in a ref, so the loop never closes
  // over a stale render.
  const settingsRef = useRef<EngineSettings>({
    clock: createIterationClock({ durationMs: 0, delayMs: 0, iterationCount: 1, direction: 'normal' }, 1),
    speed: 1,
    canPlay: false,
  });

  const canPlay = timeline.keyframes.length >= 2 && timeline.durationMs > 0;
  const durationMs = timeline.durationMs;
  const delayMs = timeline.delayMs;

  const clock = useMemo(
    () =>
      createIterationClock(
        {
          durationMs,
          delayMs,
          iterationCount: isLooping ? 'infinite' : timeline.iterationCount,
          direction: timeline.direction,
        },
        speed,
      ),
    [delayMs, durationMs, isLooping, speed, timeline.direction, timeline.iterationCount],
  );

  settingsRef.current = { clock, speed, canPlay };

  const stopFrameLoop = useCallback(() => {
    cancelTick(frameRef.current);
    frameRef.current = null;
  }, []);

  const publishProgress = useCallback((percent: number) => {
    const next = clamp(percent, 0, 100, 0);
    if (next === progressRef.current) return;
    progressRef.current = next;
    setProgressPercent(next);
    onProgressRef.current?.(next);
  }, []);

  const disposeAnimation = useCallback(() => {
    const animation = animationRef.current;
    animationRef.current = null;
    if (animation) {
      animation.onfinish = null;
      animation.oncancel = null;
      animation.cancel();
    }
    cancelScrubAnimations(targetRef.current);
  }, [targetRef]);

  const monitor = useCallback((): void => {
    const settings = settingsRef.current;
    const animation = animationRef.current;

    if (animation) {
      const currentTime = Number(animation.currentTime ?? 0);
      publishProgress(currentTimeToPercent(currentTime, settings.clock));
      if (animation.playState === 'finished') {
        if (!Number.isFinite(iterationCount(settings.clock))) {
          animation.currentTime = settings.clock.delayMs;
          animation.play();
        } else {
          stopFrameLoop();
          setIsPlaying(false);
          publishProgress(100);
          return;
        }
      }
    } else {
      // Virtual clock: advance virtual time at `speed` × real time.
      const virtualElapsed = (nowMs() - clockStartRef.current) * settings.speed;
      const total = totalActiveDurationMs(settings.clock);
      const cycle = iterationDurationMs(settings.clock);
      if (cycle > 0) {
        if (Number.isFinite(total) && virtualElapsed >= total) {
          virtualRatioRef.current = 1;
          publishProgress(100);
          stopFrameLoop();
          setIsPlaying(false);
          return;
        }
        const withinCycle = Number.isFinite(total) ? virtualElapsed % total : virtualElapsed;
        virtualRatioRef.current = withinCycle / cycle;
        publishProgress(currentTimeToPercent(withinCycle, settings.clock));
      }
    }

    frameRef.current = requestTick(monitor);
  }, [publishProgress, stopFrameLoop]);

  const play = useCallback(() => {
    const settings = settingsRef.current;
    if (!settings.canPlay || isPlaying) return;

    const node = driveNode ? targetRef.current : null;
    const source = iterationCount(settings.clock) === Number.POSITIVE_INFINITY
      ? { ...timelineRef.current, iterationCount: 'infinite' as const }
      : timelineRef.current;
    const animation = node ? createCanonicalWaapiAnimation(node, source, 'playback') : null;

    // A leftover scrub effect would fight playback for the same properties.
    cancelScrubAnimations(node);

    const startRatio = progressRef.current / 100;
    virtualRatioRef.current = startRatio;
    clockStartRef.current = nowMs() - percentToCurrentTime(progressRef.current, settings.clock) / settings.speed;

    if (animation) {
      animation.playbackRate = settings.speed;
      animation.currentTime = percentToCurrentTime(progressRef.current, settings.clock);
      animation.play();
      animationRef.current = animation;
    }

    setIsClockFallback(animation === null);
    setIsPlaying(true);
    stopFrameLoop();
    frameRef.current = requestTick(monitor);
  }, [driveNode, isPlaying, monitor, stopFrameLoop, targetRef]);

  const pause = useCallback(() => {
    animationRef.current?.pause();
    stopFrameLoop();
    setIsPlaying(false);
  }, [stopFrameLoop]);

  const toggle = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, pause, play]);

  const stop = useCallback(() => {
    stopFrameLoop();
    disposeAnimation();
    setIsPlaying(false);
    setIsClockFallback(false);
    virtualRatioRef.current = 0;
    publishProgress(0);
  }, [disposeAnimation, publishProgress, stopFrameLoop]);

  const seekRatio = useCallback(
    (ratio: number) => {
      const safeRatio = clamp(ratio, 0, 1, 0);
      // Scrubbing always wins over playback: stop the clock before posing.
      if (isPlaying) pause();
      virtualRatioRef.current = safeRatio;
      const node = driveNode ? targetRef.current : null;
      const source = timelineRef.current;
      if (node && source.keyframes.length >= 2) {
        // Pose the target with a paused scrub effect built from the real
        // keyframes, so the stage matches the exported animation exactly.
        trackScrubAnimation(node, applyScrubToDOMNode(node, source, safeRatio));
      }
      publishProgress(safeRatio * 100);
    },
    [driveNode, isPlaying, pause, publishProgress, targetRef],
  );

  const setSpeed = useCallback((next: number) => {
    const value = clamp(next, MIN_SPEED, MAX_SPEED, 1);
    setSpeedState(value);
    const animation = animationRef.current;
    if (animation) {
      animation.playbackRate = value;
      return;
    }
    if (isPlaying) {
      // Re-base the virtual clock so the new rate applies from now on.
      clockStartRef.current =
        nowMs() - percentToCurrentTime(progressRef.current, settingsRef.current.clock) / value;
    }
  }, [isPlaying]);

  const setLoop = useCallback(
    (next: boolean) => {
      setIsLooping(next);
      const node = driveNode ? targetRef.current : null;
      if (!node) return;
      // Iterations are baked into the Animation's timing, so rebuild it live
      // and restore the playhead instead of restarting the preview.
      const wasPlaying = isPlaying;
      const settings = settingsRef.current;
      disposeAnimation();
      setIsPlaying(false);
      const source = next ? { ...timelineRef.current, iterationCount: 'infinite' as const } : timelineRef.current;
      const animation = createCanonicalWaapiAnimation(node, source, 'playback');
      if (!animation) return;
      animation.playbackRate = settings.speed;
      animation.currentTime = percentToCurrentTime(progressRef.current, { ...settings.clock, iterations: next ? Number.POSITIVE_INFINITY : iterationCount(settings.clock) });
      if (wasPlaying) animation.play();
      animationRef.current = animation;
    },
    [disposeAnimation, driveNode, isPlaying, targetRef],
  );

  const stepFrames = useCallback(
    (frames: number) => {
      if (!canPlay) return;
      pause();
      if (iterationDurationMs(settingsRef.current.clock) <= 0) return;
      const nextPercent = clamp(progressRef.current + (frames / FRAME_DIVISOR) * 100, 0, 100, 0);
      seekRatio(nextPercent / 100);
    },
    [canPlay, pause, seekRatio],
  );

  // Keep the loop flag in sync when the host controls it.
  useEffect(() => {
    if (loop !== isLooping) setLoop(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop]);

  // Editing the timeline while paused re-poses the target at the same playhead;
  // while playing it restarts from the beginning so the new keyframes take effect.
  const timelineSignature = `${timeline.direction}|${timeline.fillMode}|${timeline.iterationCount}|${durationMs}|${delayMs}|${timeline.keyframes.length}`;
  useEffect(() => {
    if (isPlaying) {
      pause();
      disposeAnimation();
      publishProgress(0);
      return;
    }
    if (progressRef.current > 0) seekRatio(progressRef.current / 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineSignature]);

  useEffect(
    () => () => {
      stopFrameLoop();
      const animation = animationRef.current;
      animationRef.current = null;
      animation?.cancel();
      // A paused pose is held by a WAAPI animation that outlives the playing
      // one, so it has to be released here or it keeps styling a detached node.
      cancelScrubAnimations(targetRef.current);
    },
    [stopFrameLoop, targetRef],
  );

  return useMemo(
    () => ({
      isPlaying,
      isSupported: typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function',
      isClockFallback,
      canPlay,
      speed,
      setSpeed,
      loop: isLooping,
      setLoop,
      play,
      pause,
      toggle,
      stop,
      stepFrames,
      seekRatio,
      progressPercent,
      currentTimeMs: percentToCurrentTime(progressPercent, clock),
      effectiveDurationMs: effectiveDurationMs(clock),
      isFinished: isFinished(percentToCurrentTime(progressPercent, clock), clock),
    }),
    [
      canPlay,
      clock,
      isClockFallback,
      isLooping,
      isPlaying,
      pause,
      play,
      progressPercent,
      seekRatio,
      setLoop,
      setSpeed,
      speed,
      stepFrames,
      stop,
      toggle,
    ],
  );
}
