'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, Download, FileCode2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { EXPORT_TARGET_LABELS, type ExportTarget } from '@/types/sandbox';

export interface CodeViewerProps {
  /** Generated source for the active target. */
  code: string;
  target: ExportTarget;
  /** Generation failure, surfaced instead of stale or empty code. */
  error?: string | null;
  /** Re-runs generation, offered next to an error. */
  onRetry?: () => void;
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
 * Read-only source view for the generated export.
 *
 * Clipboard and download both go through the same try/catch so a denied
 * permission or an unsupported `navigator.clipboard` shows an inline error
 * instead of failing silently, and the copy button reports its state through
 * both the label and a live region.
 */
export function CodeViewer({
  code,
  target,
  error = null,
  onRetry,
  downloadBaseName = 'studio-animation',
  disabled = false,
  className,
}: CodeViewerProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = window.setTimeout(() => setCopyState('idle'), RESET_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const lines = useMemo(() => {
    if (!code) return [];
    const all = code.split('\n');
    return all.length > MAX_HIGHLIGHT_LINES
      ? [...all.slice(0, MAX_HIGHLIGHT_LINES), `/* … ${all.length - MAX_HIGHLIGHT_LINES} more lines */`]
      : all;
  }, [code]);

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
      <div className="flex items-center gap-2">
        <FileCode2 width={14} height={14} aria-hidden="true" className="text-studio-accent" />
        <h3 className="text-xs font-medium text-zinc-200">{EXPORT_TARGET_LABELS[target]}</h3>
        <span className="readout text-[9px] text-zinc-600">{lines.length} lines</span>

        <div className="ml-auto flex items-center gap-1">
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
        <div role="alert" className="empty-grid flex flex-col items-center gap-2 rounded-lg border border-studio-danger/40 p-6 text-center">
          <AlertTriangle width={20} height={20} aria-hidden="true" className="text-studio-danger" />
          <p className="text-[11px] text-zinc-300">{error}</p>
          {onRetry ? (
            <Button variant="secondary" size="xs" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : (
        <pre
          tabIndex={0}
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
