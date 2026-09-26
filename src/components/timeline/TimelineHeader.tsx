'use client';

import { useMemo } from 'react';
import { Diamond, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatMillisecondsAsSeconds } from '@/lib/cssGenerator';
import { Button } from '@/components/ui/Button';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  ANIMATION_DIRECTIONS,
  ANIMATION_FILL_MODE_LABELS,
  ANIMATION_FILL_MODES,
  TIMELINE_LIMITS,
  type AnimationDirection,
  type AnimationFillMode,
  type AnimationIteration,
  type AnimationTimeline,
  type ValidationError,
} from '@/types/sandbox';

export interface TimelineHeaderProps {
  timeline: AnimationTimeline;
  /** Patch emitted by any field; the host validates and records history. */
  onChange: (patch: Partial<AnimationTimeline>, commit: boolean) => void;
  /** Inserts a keyframe at the current playhead position. */
  onAddKeyframe: () => void;
  onDeleteKeyframe?: () => void;
  /** Validation errors keyed by field name, from `validateTimelineTiming`. */
  errors?: readonly ValidationError[];
  canAddKeyframe?: boolean;
  canDeleteKeyframe?: boolean;
  disabled?: boolean;
  className?: string;
}

const DIRECTION_OPTIONS: ReadonlyArray<{ value: AnimationDirection; label: string }> = ANIMATION_DIRECTIONS.map(
  (value) => ({ value, label: value.replace(/-/g, ' ') }),
);

const FILL_MODE_OPTIONS: ReadonlyArray<{ value: AnimationFillMode; label: string }> = ANIMATION_FILL_MODES.map(
  (value) => ({ value, label: ANIMATION_FILL_MODE_LABELS[value] }),
);

const ITERATION_PRESETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: 'infinite', label: '∞ infinite' },
];

/**
 * Timeline identity and timing controls.
 *
 * Duration and delay are typed in seconds but stored in milliseconds, so the
 * conversion happens in one place per field; iteration count is a select with
 * an explicit infinite option because `1.5` iterations is not a legal value
 * that a number input can express honestly.
 */
export function TimelineHeader({
  timeline,
  onChange,
  onAddKeyframe,
  onDeleteKeyframe,
  errors = [],
  canAddKeyframe = true,
  canDeleteKeyframe = true,
  disabled = false,
  className,
}: TimelineHeaderProps) {
  const errorFor = useMemo(() => {
    const map = new Map<string, string>();
    for (const error of errors) {
      if (!map.has(error.field)) map.set(error.field, error.message);
    }
    return map;
  }, [errors]);

  const durationSeconds = Number((timeline.durationMs / 1000).toFixed(3));
  const delaySeconds = Number((timeline.delayMs / 1000).toFixed(3));
  const iterationValue = timeline.iterationCount === 'infinite' ? 'infinite' : String(timeline.iterationCount);

  return (
    <header
      className={cn('panel-surface flex flex-col gap-3 p-3', className)}
      aria-label={`Timeline settings for ${timeline.name}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="truncate-tight text-sm font-medium text-zinc-100">{timeline.name}</h2>
        <span className="readout rounded bg-obsidian-800 px-1.5 py-0.5 text-[9px] text-zinc-400">
          {timeline.keyframes.length} keyframes
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="secondary" size="sm" iconLeft={Diamond} onClick={onAddKeyframe} disabled={disabled || !canAddKeyframe}>
            Add keyframe
          </Button>
          {onDeleteKeyframe ? (
            <Tooltip content="Delete the selected keyframe">
              <Button
                variant="ghost"
                size="icon-sm"
                iconLeft={Trash2}
                onClick={onDeleteKeyframe}
                disabled={disabled || !canDeleteKeyframe}
                ariaLabel="Delete the selected keyframe"
              />
            </Tooltip>
          ) : null}
        </div>
      </div>

      {/* Container-scoped on purpose: this panel lives in a fixed 19rem sidebar,
          so viewport breakpoints squeeze five fields into ~55px each and the
          labels collide with the steppers. Two columns keeps every control wide
          enough to show its label, value and unit. */}
      <div className="grid grid-cols-2 gap-2">
        <NumberInput
          label="Duration"
          value={durationSeconds}
          onChange={(value) => onChange({ durationMs: Math.round(value * 1000) }, false)}
          onCommit={(value) => onChange({ durationMs: Math.round(value * 1000) }, true)}
          min={TIMELINE_LIMITS.durationMs.min / 1000}
          max={TIMELINE_LIMITS.durationMs.max / 1000}
          step={0.1}
          precision={3}
          unit="s"
          disabled={disabled}
          error={errorFor.get('durationMs') ?? null}
        />
        <NumberInput
          label="Delay"
          value={delaySeconds}
          onChange={(value) => onChange({ delayMs: Math.round(value * 1000) }, false)}
          onCommit={(value) => onChange({ delayMs: Math.round(value * 1000) }, true)}
          min={0}
          max={TIMELINE_LIMITS.delayMs.max / 1000}
          step={0.1}
          precision={3}
          unit="s"
          disabled={disabled}
          error={errorFor.get('delayMs') ?? null}
        />
        <Select
          value={iterationValue}
          options={ITERATION_PRESETS}
          onChange={(value) =>
            onChange({ iterationCount: value === 'infinite' ? ('infinite' as const) : (Number(value) as AnimationIteration) }, true)
          }
          label="Iterations"
          size="sm"
          disabled={disabled}
          error={errorFor.get('iterationCount') ?? null}
        />
        <Select
          value={timeline.direction}
          options={DIRECTION_OPTIONS}
          onChange={(value) => onChange({ direction: value }, true)}
          label="Direction"
          size="sm"
          disabled={disabled}
        />
        <Select
          value={timeline.fillMode}
          options={FILL_MODE_OPTIONS}
          onChange={(value) => onChange({ fillMode: value }, true)}
          label="Fill mode"
          size="sm"
          disabled={disabled}
        />
      </div>

      <p className="readout text-[9px] text-zinc-400">
        {formatMillisecondsAsSeconds(timeline.durationMs)} active ·{' '}
        {timeline.iterationCount === 'infinite' ? 'infinite' : timeline.iterationCount} iteration
        {timeline.iterationCount === 1 || timeline.iterationCount === 'infinite' ? '' : 's'} ·{' '}
        {timeline.direction}
      </p>
    </header>
  );
}
