'use client';

import { useMemo } from 'react';
import { X } from 'lucide-react';
import { generateVanillaStylesheet, generateWebAnimationsApiCode } from '@/lib/cssGenerator';
import { generateTailwindV4Stylesheet } from '@/lib/tailwindFormatter';
import { CodeViewer } from '@/components/exporter/CodeViewer';
import { OutputConfigBar } from '@/components/exporter/OutputConfigBar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { validateCssIdentifier, type AnimationTimeline, type ExportOptions } from '@/types/sandbox';

export interface ExportDrawerProps {
  open: boolean;
  onClose: () => void;
  timeline: AnimationTimeline;
  options: ExportOptions;
  onOptionsChange: (patch: Partial<ExportOptions>, commit: boolean) => void;
  /** Timeline with fewer than two keyframes cannot produce a valid export. */
  isExportable: boolean;
  className?: string;
}

interface GenerationResult {
  code: string;
  error: string | null;
}

/**
 * Renders the export for the active target.
 *
 * Generation is intentionally a pure derivation of `(timeline, options)`, and
 * an invalid identifier is reported as a generation error instead of silently
 * exporting a renamed class — the drawer must never show output that does not
 * match the fields the user typed.
 */
function generateExport(timeline: AnimationTimeline, options: ExportOptions): GenerationResult {
  const identifierErrors = [
    ...validateCssIdentifier('animationClassName', options.animationClassName),
    ...validateCssIdentifier('keyframeRuleName', options.keyframeRuleName),
  ];
  if (identifierErrors.length > 0) {
    return {
      code: '',
      error: identifierErrors.map((issue) => issue.message).join(' '),
    };
  }

  try {
    if (options.target === 'tailwind-v4') {
      return {
        code: generateTailwindV4Stylesheet(timeline, {
          animationClassName: options.animationClassName,
          keyframeRuleName: options.keyframeRuleName,
          includeVendorPrefixes: options.includeVendorPrefixes,
          prettify: options.prettify,
        }),
        error: null,
      };
    }
    if (options.target === 'web-animations-api') {
      return {
        code: generateWebAnimationsApiCode(timeline, {
          animationClassName: options.animationClassName,
          keyframeRuleName: options.keyframeRuleName,
          prettify: options.prettify,
        }),
        error: null,
      };
    }
    return { code: generateVanillaStylesheet(timeline, options), error: null };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Unknown generation failure';
    return { code: '', error: `Export failed: ${message}` };
  }
}

/**
 * Export surface: configuration on top, generated source below.
 *
 * It reuses the accessible `Modal` dialog (focus trap, Escape, scroll lock) and
 * only restyles it as a right-hand drawer from the tablet breakpoint up, where
 * there is room for a side panel; below that it is a full-height sheet.
 */
export function ExportDrawer({
  open,
  onClose,
  timeline,
  options,
  onOptionsChange,
  isExportable,
  className,
}: ExportDrawerProps) {
  const { code, error } = useMemo(
    () => generateExport(timeline, options),
    [timeline, options],
  );

  const frameCount = timeline.keyframes.length;
  const displayError = !isExportable
    ? `Add at least two keyframes to export "${timeline.name}" — CSS keyframes need a start and an end state.`
    : error;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export"
      description={`${timeline.name} · ${frameCount} keyframe${frameCount === 1 ? '' : 's'}`}
      size="xl"
      className={className}
      footer={
        <>
          <span className="mr-auto readout text-[9px] text-zinc-600">
            {isExportable ? 'Generated from the current keyframes' : 'Export blocked by timeline state'}
          </span>
          <Button variant="secondary" size="sm" iconLeft={X} onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <OutputConfigBar options={options} onChange={onOptionsChange} />
        <CodeViewer code={code} target={options.target} error={displayError} downloadBaseName={options.keyframeRuleName} />
      </div>
    </Modal>
  );
}
