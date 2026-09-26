'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  CloudOff,
  Cloudy,
  Download,
  Loader2,
  Redo2,
  Save,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import type { ProjectRecord } from '@/types/sandbox';

/** Mirrors `useLocalStorageSync`'s status union for the save indicator. */
export type SaveStatus = 'hydrating' | 'idle' | 'saving' | 'saved' | 'error';

export interface StudioTopNavProps {
  project: ProjectRecord;
  activeTimelineName: string;
  status: SaveStatus;
  /** Human-readable persistence state, e.g. "Saved 2s ago". */
  statusMessage: string;
  /** True when localStorage is unavailable and the project lives in memory. */
  isDegraded: boolean;
  wasMigrated: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
  onUndo: () => void;
  onRedo: () => void;
  onOpenPresets: () => void;
  onOpenExport: () => void;
  onRenameProject: (name: string) => void;
  disabled?: boolean;
  className?: string;
}

const STATUS_META: Readonly<
  Record<SaveStatus, { label: string; icon: typeof Save; tone: string; spin: boolean }>
> = {
  hydrating: { label: 'Restoring', icon: Loader2, tone: 'text-zinc-400', spin: true },
  idle: { label: 'Autosave on', icon: Cloudy, tone: 'text-zinc-400', spin: false },
  saving: { label: 'Saving', icon: Loader2, tone: 'text-studio-warning', spin: true },
  saved: { label: 'Saved', icon: Save, tone: 'text-studio-success', spin: false },
  error: { label: 'Save failed', icon: CloudOff, tone: 'text-studio-danger', spin: false },
};

/**
 * Application chrome: identity, persistence state, history and the two
 * disclosure surfaces.
 *
 * The save indicator is a live region because a silent persistence failure is
 * indistinguishable from "nothing happened" — when the browser blocks
 * storage, the degraded pill is the only signal the user gets.
 */
export function StudioTopNav({
  project,
  activeTimelineName,
  status,
  statusMessage,
  isDegraded,
  wasMigrated,
  canUndo,
  canRedo,
  undoDepth,
  redoDepth,
  onUndo,
  onRedo,
  onOpenPresets,
  onOpenExport,
  onRenameProject,
  disabled = false,
  className,
}: StudioTopNavProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(project.name);
  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;

  useEffect(() => {
    if (!isEditingName) setDraftName(project.name);
  }, [isEditingName, project.name]);

  const commitName = () => {
    setIsEditingName(false);
    const trimmed = draftName.trim();
    if (trimmed.length === 0 || trimmed === project.name) {
      setDraftName(project.name);
      return;
    }
    onRenameProject(trimmed.slice(0, 60));
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-obsidian-700/70 bg-obsidian-950/85 px-3 py-2 backdrop-blur-md',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-studio-accent/15 text-studio-accent">
          <Box width={15} height={15} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col leading-tight">
          {isEditingName ? (
            <input
              type="text"
              value={draftName}
              autoFocus
              maxLength={60}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitName();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setDraftName(project.name);
                  setIsEditingName(false);
                }
              }}
              aria-label="Project name"
              className="w-40 rounded-md border border-studio-accent/60 bg-obsidian-900 px-1.5 text-xs text-zinc-100 outline-none focus-visible:ring-1 focus-visible:ring-studio-accent"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              className="truncate-tight rounded text-left text-xs font-semibold text-zinc-100 hover:text-studio-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-accent"
              aria-label={`Rename project ${project.name}`}
            >
              {project.name}
            </button>
          )}
          <span className="readout truncate text-[9px] text-zinc-400">{activeTimelineName}</span>
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <p className="readout flex items-center gap-1.5 text-[9px] text-zinc-400">
          <StatusIcon width={12} height={12} aria-hidden="true" className={cn(meta.tone, meta.spin && 'animate-spin')} />
          <span aria-live="polite" className={meta.tone}>
            {statusMessage || meta.label}
          </span>
        </p>

        {isDegraded ? (
          <span className="rounded-md border border-studio-warning/40 bg-studio-warning/10 px-1.5 py-0.5 text-[9px] text-studio-warning">
            In-memory only
          </span>
        ) : null}
        {wasMigrated ? (
          <span className="rounded-md border border-studio-violet-soft/40 bg-studio-violet/10 px-1.5 py-0.5 text-[9px] text-studio-violet-soft">
            Upgraded from an older schema
          </span>
        ) : null}

        <div className="flex items-center gap-1">
          <Tooltip content={canUndo ? `Undo (${undoDepth} available)` : 'Nothing to undo'}>
            <Button
              variant="ghost"
              size="icon-sm"
              iconLeft={Undo2}
              onClick={onUndo}
              disabled={disabled || !canUndo}
              ariaLabel="Undo last change"
            />
          </Tooltip>
          <Tooltip content={canRedo ? `Redo (${redoDepth} available)` : 'Nothing to redo'}>
            <Button
              variant="ghost"
              size="icon-sm"
              iconLeft={Redo2}
              onClick={onRedo}
              disabled={disabled || !canRedo}
              ariaLabel="Redo last change"
            />
          </Tooltip>
        </div>

        {/* The label span collapses to `display:none` below `sm`, which leaves
            the button icon-only there, so the name has to come from the button
            itself rather than from its contents. It is set to the *visible*
            label on purpose: `aria-label` overrides descendant text, so naming
            the button "Open presets" here would rename it at desktop widths
            too, and the spoken name would stop matching the on-screen word. */}
        <Button
          variant="secondary"
          size="sm"
          iconLeft={Sparkles}
          onClick={onOpenPresets}
          disabled={disabled}
          ariaLabel="Presets"
        >
          <span className="hidden sm:inline">Presets</span>
        </Button>
        <Button
          variant="primary"
          size="sm"
          iconLeft={Download}
          onClick={onOpenExport}
          disabled={disabled}
          ariaLabel="Export"
        >
          <span className="hidden sm:inline">Export</span>
        </Button>
      </div>
    </header>
  );
}
