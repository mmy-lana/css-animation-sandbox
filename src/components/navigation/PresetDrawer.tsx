'use client';

import { useMemo, useState } from 'react';
import { Layers, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatMillisecondsAsSeconds } from '@/lib/cssGenerator';
import { ANIMATION_PRESETS, groupPresetsByCategory, resolveUniqueTimelineName, type AnimationPreset } from '@/lib/presets';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { AnimationTimeline, PreviewConfig } from '@/types/sandbox';

export interface PresetDrawerProps {
  open: boolean;
  onClose: () => void;
  /**
   * Applies a preset. Either replaces the active timeline, or — when
   * `mode === 'append'` — adds it as a new timeline in the same project.
   */
  onApply: (timeline: AnimationTimeline, preview: Partial<PreviewConfig>, mode: 'replace' | 'append') => void;
  /** Names that would collide when appending, shown inline on the card. */
  existingTimelineNames?: readonly string[];
  className?: string;
}

type Filter = 'all' | AnimationPreset['category'];

const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'motion', label: 'Motion' },
  { value: 'attention', label: 'Attention' },
  { value: 'material', label: 'Material' },
  { value: 'type', label: 'Type' },
];

/**
 * Preset browser.
 *
 * A preset is a starter timeline, never a destructive action: "append" keeps
 * the current timeline and adds the preset beside it, while "replace" is
 * explicit and announced. A name collision is resolved with a numeric suffix
 * instead of silently overwriting an existing timeline.
 */
export function PresetDrawer({
  open,
  onClose,
  onApply,
  existingTimelineNames = [],
  className,
}: PresetDrawerProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matched = ANIMATION_PRESETS.filter((preset) => {
      if (filter !== 'all' && preset.category !== filter) return false;
      if (normalized.length === 0) return true;
      return (
        preset.name.toLowerCase().includes(normalized) || preset.description.toLowerCase().includes(normalized)
      );
    });
    return groupPresetsByCategory(matched);
  }, [filter, query]);

  const totalMatches = groups.reduce((sum, group) => sum + group.presets.length, 0);
  const isFiltered = filter !== 'all' || query.trim().length > 0;

  const apply = (preset: AnimationPreset, mode: 'replace' | 'append') => {
    const timeline = preset.build();
    if (mode === 'append') {
      // Appending keeps every timeline addressable, so a colliding name gets the
      // smallest free numeric suffix instead of silently shadowing an existing one.
      timeline.name = resolveUniqueTimelineName(timeline.name, existingTimelineNames);
    }
    onApply(timeline, preset.preview, mode);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Presets"
      description="Start from a curated timeline, then edit every value — presets are ordinary timelines."
      size="lg"
      className={className}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex flex-1 items-center gap-2 rounded-md border border-obsidian-700 bg-obsidian-900 px-2">
            <Search width={13} height={13} aria-hidden="true" className="text-zinc-600" />
            <span className="sr-only">Search presets</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search presets"
              className="h-8 w-full bg-transparent text-xs text-zinc-100 outline-none placeholder:text-zinc-600"
            />
          </label>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter presets by category">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                aria-pressed={filter === option.value}
                className={cn(
                  'h-8 rounded-md border px-2.5 text-[11px] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-accent',
                  filter === option.value
                    ? 'border-studio-accent/60 bg-studio-accent/10 text-studio-accent'
                    : 'border-obsidian-700 text-zinc-400 hover:border-obsidian-600 hover:text-zinc-200',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {totalMatches === 0 ? (
          <div className="empty-grid flex flex-col items-center gap-2 rounded-lg border border-dashed border-obsidian-600 p-8 text-center">
            <Sparkles width={20} height={20} aria-hidden="true" className="text-zinc-500" />
            <p className="text-[11px] text-zinc-400">No preset matches “{query.trim()}”.</p>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => {
                setQuery('');
                setFilter('all');
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <section key={group.category} aria-labelledby={`preset-group-${group.category}`}>
                <h3
                  id={`preset-group-${group.category}`}
                  className="mb-2 text-[10px] tracking-widest text-zinc-500 uppercase"
                >
                  {group.label}
                </h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {group.presets.map((preset) => (
                    <PresetCard key={preset.id} preset={preset} onApply={apply} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {isFiltered ? (
          <p className="readout text-[9px] text-zinc-600">
            {totalMatches} of {ANIMATION_PRESETS.length} presets shown
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function PresetCard({
  preset,
  onApply,
}: {
  preset: AnimationPreset;
  onApply: (preset: AnimationPreset, mode: 'replace' | 'append') => void;
}) {
  const preview = useMemo(() => preset.build(), [preset]);

  return (
    <li className="panel-surface flex flex-col gap-2 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="truncate-tight text-xs font-medium text-zinc-100">{preset.name}</h4>
          <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">{preset.description}</p>
        </div>
        <Layers width={13} height={13} aria-hidden="true" className="mt-0.5 shrink-0 text-studio-violet-soft" />
      </div>

      <p className="readout text-[9px] text-zinc-600">
        {preview.keyframes.length} keyframes · {formatMillisecondsAsSeconds(preview.durationMs)}s ·{' '}
        {preview.iterationCount === 'infinite' ? 'infinite' : `${preview.iterationCount}×`} · {preview.direction}
      </p>

      <div className="mt-auto flex items-center gap-1.5">
        <Button variant="primary" size="xs" onClick={() => onApply(preset, 'replace')}>
          Use preset
        </Button>
        <Button variant="ghost" size="xs" onClick={() => onApply(preset, 'append')}>
          Add as new timeline
        </Button>
      </div>
    </li>
  );
}
