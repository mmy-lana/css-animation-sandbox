'use client';

import { useCallback } from 'react';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatMillisecondsAsSeconds } from '@/lib/cssGenerator';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { KeyframeNode } from '@/components/timeline/KeyframeNode';
import { Playhead } from '@/components/timeline/Playhead';
import { TrackRuler } from '@/components/timeline/TrackRuler';
import type { TimelineScrubber } from '@/hooks/useTimelineScrubber';
import type { KeyframePoint } from '@/types/sandbox';

export interface ScrubBarProps {
  /** Scrubber state from `useTimelineScrubber`. */
  scrubber: TimelineScrubber;
  /** Timeline duration, used by the ruler and the keyframe time labels. */
  durationMs: number;
  keyframes: readonly KeyframePoint[];
  activeKeyframeId: string | null;
  isPlaying: boolean;
  onTogglePlayback: () => void;
  /** Rewinds to the first frame. */
  onStop: () => void;
  /** Steps the playhead by 60Hz frames; negative values go backwards. */
  onStepFrames: (frames: number) => void;
  onSelectKeyframe: (keyframeId: string) => void;
  /** Offset change from a keyframe drag; `commit` closes the gesture. */
  onKeyframeOffsetChange: (keyframeId: string, offset: number, commit: boolean) => void;
  onDeleteKeyframe?: (keyframeId: string) => void;
  disabled?: boolean;
  className?: string;
}

/** A single 60Hz frame of the timeline duration. */
const FRAME_STEP = 1;

/**
 * Transport controls plus the interactive keyframe track.
 *
 * One surface owns the pointer: the track container maps client X to 0…100% and
 * the ruler is rendered presentationally, so the ruler and the keyframe row can
 * never disagree about where the playhead is. The playhead itself is the
 * `slider` in the accessibility tree, which keeps a single tab stop for seeking
 * and lets the scrubber own the RAF-coalesced drag.
 */
export function ScrubBar({
  scrubber,
  durationMs,
  keyframes,
  activeKeyframeId,
  isPlaying,
  onTogglePlayback,
  onStop,
  onStepFrames,
  onSelectKeyframe,
  onKeyframeOffsetChange,
  onDeleteKeyframe,
  disabled = false,
  className,
}: ScrubBarProps) {
  const {
    offsetPercent,
    currentTimeMs,
    timecode,
    durationLabel,
    delayMs,
    isScrubbing,
    trackRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown,
  } = scrubber;

  const attachTrack = useCallback(
    (node: HTMLDivElement | null) => {
      (trackRef as { current: HTMLDivElement | null }).current = node;
    },
    [trackRef],
  );

  return (
    <section className={cn('panel-surface flex flex-col gap-3 p-3', className)} aria-label="Animation transport">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={isPlaying ? 'secondary' : 'primary'}
          size="sm"
          iconLeft={isPlaying ? Pause : Play}
          onClick={onTogglePlayback}
          disabled={disabled}
          ariaLabel={isPlaying ? 'Pause animation' : 'Play animation'}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </Button>

        <div className="flex items-center gap-1">
          <Tooltip content="Step back one frame">
            <Button
              variant="ghost"
              size="icon-sm"
              iconLeft={SkipBack}
              onClick={() => onStepFrames(-FRAME_STEP)}
              disabled={disabled}
              ariaLabel="Step back one frame"
            />
          </Tooltip>
          <Tooltip content="Step forward one frame">
            <Button
              variant="ghost"
              size="icon-sm"
              iconLeft={SkipForward}
              onClick={() => onStepFrames(FRAME_STEP)}
              disabled={disabled}
              ariaLabel="Step forward one frame"
            />
          </Tooltip>
          <Tooltip content="Return to the first frame">
            <Button
              variant="ghost"
              size="icon-sm"
              iconLeft={RotateCcw}
              onClick={onStop}
              disabled={disabled}
              ariaLabel="Rewind to the start"
            />
          </Tooltip>
        </div>

        <div className="ml-auto flex items-baseline gap-2">
          <span className="readout text-zinc-100">{timecode}</span>
          <span className="readout text-zinc-400">
            / {durationLabel}s
            {delayMs > 0 ? (
              <span className="ml-1.5 text-studio-violet-soft">+{formatMillisecondsAsSeconds(delayMs)}s delay</span>
            ) : null}
          </span>
        </div>
      </div>

      <div className="relative flex flex-col gap-1.5">
        <TrackRuler
          durationMs={durationMs}
          offsetPercent={offsetPercent}
          onSeek={scrubber.setOffsetPercent}
          delayMs={delayMs}
          presentational
        />

        {/* The single seek surface: taps on empty space move the playhead. */}
        <div
          ref={attachTrack}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
          role="group"
          aria-label="Keyframe track"
          className={cn(
            'relative h-11 touch-none rounded-md border border-obsidian-700/60 bg-obsidian-850/40',
            'focus-within:border-studio-accent/40',
          )}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-linear-to-r from-studio-accent/20 via-obsidian-600 to-studio-accent/20"
          />

          {keyframes.length === 0 ? (
            <p className="absolute inset-0 grid place-items-center text-[10px] text-zinc-400">
              No keyframes — add one to start animating.
            </p>
          ) : (
            keyframes.map((keyframe) => (
              <KeyframeNode
                key={keyframe.id}
                keyframe={keyframe}
                durationMs={durationMs}
                isActive={keyframe.id === activeKeyframeId}
                isSelected={keyframe.id === activeKeyframeId}
                onSelect={onSelectKeyframe}
                onOffsetChange={onKeyframeOffsetChange}
                onDelete={onDeleteKeyframe}
                disabled={disabled}
              />
            ))
          )}

          <Playhead
            offsetPercent={offsetPercent}
            timecode={timecode}
            currentTimeMs={currentTimeMs}
            isActive={isScrubbing || isPlaying}
            onKeyDown={handleKeyDown}
          />
        </div>

        <p className="readout text-[9px] text-zinc-400">
          Drag the track to scrub · ← → steps 1% (Shift 5%) · Home/End jump to the endpoints
        </p>
      </div>
    </section>
  );
}
