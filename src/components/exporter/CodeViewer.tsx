'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { AlertTriangle, Check, Copy, Download } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { EXPORT_TARGETS, EXPORT_TARGET_LABELS, type ExportTarget } from '@/types/sandbox';

export interface CodeViewerProps {
  /** Generated source for the active target. */
  code: string;
  target: ExportTarget;
  /** Switches the active tab. Omit to render a non-interactive heading instead. */
  onTargetChange?: (target: ExportTarget) => void;
  /** Generation failure, surfaced instead of stale or empty code. */
  error?: string | null;
  /** Suggested download filename without extension. */
  downloadBaseName?: string;
  disabled?: boolean;
  className?: string;
}

type CopyState = 'idle' | 'copied' | 'failed';
const RESET_DELAY_MS = 1800;

const FILE_EXTENSIONS: Readonly<Record<ExportTarget, string>> = {
  'vanilla-css': 'css',
  'tailwind-v4': 'css',
  'web-animations-api': 'js',
};

const MIME_TYPES: Readonly<Record<ExportTarget, string>> = {
  'vanilla-css': 'text/css',
  'tailwind-v4': 'text/css',
  'web-animations-api': 'text/javascript',
};

const MAX_HIGHLIGHT_LINES = 4000;

/**
 * Read-only source view for the generated export, with one tab per target.
 *
 * The tabs follow the WAI-ARIA tabs pattern: only the selected tab is tabbable
 * and the arrow keys move between them. Clipboard and download both go through
 * the same try/catch so a denied permission or an unsupported
 * `navigator.clipboard` shows an inline error instead of failing silently, and
 * the copy button reports its state through both the label and a live region.
 */
export function CodeViewer({
  code,
  target,
  onTargetChange,
  error = null,
  downloadBaseName = 'studio-animation',
  disabled = false,
  className,
}: CodeViewerProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const tabRefs = useRef(new Map<ExportTarget, HTMLButtonElement>());

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = window.setTimeout(() => setCopyState('idle'), RESET_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  // Switching target replaces the code under the pointer, so a stale "Copied"
  // confirmation would describe the previous file.
  useEffect(() => {
    setCopyState('idle');
  }, [target]);

  const lines = useMemo(() => {
    if (!code) return [];
    const all = code.split('\n');
    return all.length > MAX_HIGHLIGHT_LINES
      ? [...all.slice(0, MAX_HIGHLIGHT_LINES), `/* … ${all.length - MAX_HIGHLIGHT_LINES} more lines */`]
      : all;
  }, [code]);

  const focusTab = useCallback(
    (next: ExportTarget) => {
      onTargetChange?.(next);
      // The newly selected tab becomes the only tab stop, so focus follows it.
      requestAnimationFrame(() => tabRefs.current.get(next)?.focus());
    },
    [onTargetChange],
  );

  const onTabKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
      const lastIndex = EXPORT_TARGETS.length - 1;
      const offsets: Record<string, number> = {
        ArrowRight: index === lastIndex ? 0 : index + 1,
        ArrowLeft: index === 0 ? lastIndex : index - 1,
        Home: 0,
        End: lastIndex,
      };
      const targetIndex = offsets[event.key];
      if (targetIndex === undefined) return;
      event.preventDefault();
      focusTab(EXPORT_TARGETS[targetIndex]);
    },
    [focusTab],
  );

  const copy = useCallback(async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }, [code]);

  const download = useCallback(() => {
    try {
      const blob = new Blob([code], { type: MIME_TYPES[target] });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${downloadBaseName}.${FILE_EXTENSIONS[target]}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setCopyState('failed');
    }
  }, [code, downloadBaseName, target]);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        role="tablist"
        aria-label="Export target"
        className="flex items-center gap-1 border-b border-obsidian-700/60"
      >
        {EXPORT_TARGETS.map((candidate, index) => {
          const isSelected = candidate === target;
          return (
            <button
              key={candidate}
              type="button"
              role="tab"
              id={`export-tab-${candidate}`}
              aria-selected={isSelected}
              aria-controls={`export-panel-${candidate}`}
              tabIndex={isSelected ? 0 : -1}
              ref={(node) => {
                if (node) tabRefs.current.set(candidate, node);
                else tabRefs.current.delete(candidate);
              }}
              onClick={() => focusTab(candidate)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              disabled={disabled}
              className={cn(
                '-mb-px flex items-center gap-1.5 rounded-t-md border-b-2 px-2.5 py-1.5 text-[11px] transition-colors',
                'outline-none focus-visible:ring-1 focus-visible:ring-studio-accent disabled:pointer-events-none disabled:opacity-50',
                isSelected
                  ? 'border-studio-accent text-studio-accent'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300',
              )}
            >
              {EXPORT_TARGET_LABELS[candidate]}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-1">
          <span className="readout text-[9px] text-zinc-600">{lines.length} lines</span>
          <Tooltip content="Copy to clipboard">
            <Button
              variant="ghost"
              size="sm"
              iconLeft={copyState === 'copied' ? Check : Copy}
              onClick={copy}
              disabled={disabled || !code}
              ariaLabel="Copy generated code to clipboard"
            >
              {copyState === 'copied' ? 'Copied' : 'Copy'}
            </Button>
          </Tooltip>
          <Tooltip content={`Download as .${FILE_EXTENSIONS[target]}`}>
            <Button
              variant="ghost"
              size="icon-sm"
              iconLeft={Download}
              onClick={download}
              disabled={disabled || !code}
              ariaLabel="Download generated file"
            />
          </Tooltip>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {copyState === 'copied' ? 'Code copied to clipboard' : null}
        {copyState === 'failed' ? 'Copy failed. Select the code and copy it manually.' : null}
      </p>

      {error ? (
        <div
          id={`export-panel-${target}`}
          role="tabpanel"
          aria-labelledby={`export-tab-${target}`}
          className="empty-grid flex flex-col items-center gap-2 rounded-lg border border-studio-danger/40 p-6 text-center"
        >
          <AlertTriangle width={20} height={20} aria-hidden="true" className="text-studio-danger" />
          <p role="alert" className="text-[11px] text-zinc-300">
            {error}
          </p>
        </div>
      ) : (
        <pre
          tabIndex={0}
          id={`export-panel-${target}`}
          role="tabpanel"
          aria-labelledby={`export-tab-${target}`}
          aria-label={`Generated ${EXPORT_TARGET_LABELS[target]} source`}
          className={cn(
            'max-h-[46dvh] overflow-auto rounded-lg border border-obsidian-700/60 bg-obsidian-900 p-3',
            'text-[11px] leading-relaxed text-zinc-300 outline-none focus-visible:ring-1 focus-visible:ring-studio-accent',
          )}
        >
          <code>
            {lines.map((line, index) => (
              <span key={index} className="flex">
                <span aria-hidden="true" className="readout w-9 shrink-0 pr-3 text-right text-zinc-700 select-none">
                  {index + 1}
                </span>
                <span className="whitespace-pre">{line === '' ? ' ' : line}</span>
              </span>
            ))}
          </code>
        </pre>
      )}

      {copyState === 'failed' && !error ? (
        <p className="text-[10px] text-studio-danger">
          The browser blocked clipboard access — select the code above and copy it manually.
        </p>
      ) : null}
    </div>
  );
}
