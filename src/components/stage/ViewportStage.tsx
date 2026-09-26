'use client';

import { useMemo, useState, type RefObject } from 'react';
import { Grid3x3, Maximize2, RotateCcw, Scan } from 'lucide-react';
import { cn } from '@/lib/cn';
import { composeTransformCSS } from '@/lib/cssGenerator';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { Tooltip } from '@/components/ui/Tooltip';
import { TargetGeometry } from '@/components/stage/TargetGeometry';
import { TransformGizmo, type GizmoMode } from '@/components/stage/TransformGizmo';
import { Visualizers3D } from '@/components/stage/Visualizers3D';
import {
  PREVIEW_ELEMENT_SHAPES,
  VIEWPORT_BACKGROUNDS,
  clampNumber,
  type KeyframePoint,
  type KeyframeProperties,
  type PreviewConfig,
  type PreviewElementShape,
  type ViewportBackground,
} from '@/types/sandbox';

export interface ViewportStageProps {
  preview: PreviewConfig;
  onPreviewChange: (patch: Partial<PreviewConfig>, commit: boolean) => void;
  /** Properties of the keyframe currently under the playhead. */
  properties: KeyframeProperties;
  shape: PreviewElementShape;
  /** Node handed to the animation engine. */
  targetRef: RefObject<HTMLDivElement | null>;
  gizmoMode: GizmoMode;
  onTransformChange: (patch: Partial<KeyframePoint['properties']['transform']>, commit: boolean) => void;
  /** Keyframe shown in the gizmo readout. */
  activeKeyframe?: KeyframePoint | null;
  /** Most recent transform strings for the motion trail overlay. */
  trailSamples?: readonly string[];
  /** Viewport perspective in pixels. */
  perspective: number;
  onPerspectiveChange: (value: number) => void;
  /** 3D gimbal is hidden below the desktop breakpoint. */
  enable3dGizmo?: boolean;
  isPlaying?: boolean;
  disabled?: boolean;
  className?: string;
}

const PERSPECTIVE_LIMITS = { min: 200, max: 2400, step: 20 } as const;
const ZOOM_LIMITS = { min: 50, max: 200, step: 5 } as const;

const BACKGROUND_OPTIONS: ReadonlyArray<{ value: ViewportBackground; label: string }> = [
  { value: 'grid-dark', label: 'Studio grid' },
  { value: 'dots', label: 'Dot matrix' },
  { value: 'checkerboard', label: 'Checkerboard' },
  { value: 'solid-obsidian', label: 'Solid obsidian' },
];

const SHAPE_OPTIONS: ReadonlyArray<{ value: PreviewElementShape; label: string }> = PREVIEW_ELEMENT_SHAPES.map(
  (value) => ({ value, label: value.replace(/-/g, ' ') }),
);

const BACKGROUND_CLASSES: Readonly<Record<ViewportBackground, string>> = {
  'grid-dark': 'bg-obsidian-950 bg-[linear-gradient(to_right,rgba(39,39,42,0.55)_1px,transparent_1px),linear-gradient(to_bottom,rgba(39,39,42,0.55)_1px,transparent_1px)] bg-[size:32px_32px]',
  dots: 'bg-obsidian-950 bg-[radial-gradient(rgba(82,82,91,0.65)_1px,transparent_1px)] bg-[size:24px_24px]',
  checkerboard:
    'bg-obsidian-950 bg-[linear-gradient(45deg,rgba(39,39,42,0.6)_25%,transparent_25%,transparent_75%,rgba(39,39,42,0.6)_75%),linear-gradient(45deg,rgba(39,39,42,0.6)_25%,transparent_25%,transparent_75%,rgba(39,39,42,0.6)_75%)] bg-[size:32px_32px] bg-[position:0_0,16px_16px]',
  'solid-obsidian': 'bg-obsidian-950',
};

/**
 * The live preview viewport.
 *
 * The stage owns the perspective wrapper so `rotateX/rotateY` on the keyframe
 * can only ever be read against a known 3D context, and it is the single place
 * that composes the background, the overlays and the gizmo. Zoom and
 * perspective are view settings, never keyframe properties, so they are applied
 * on wrappers outside the animated node.
 */
export function ViewportStage({
  preview,
  onPreviewChange,
  properties,
  shape,
  targetRef,
  gizmoMode,
  onTransformChange,
  activeKeyframe = null,
  trailSamples,
  perspective,
  onPerspectiveChange,
  enable3dGizmo = true,
  isPlaying = false,
  disabled = false,
  className,
}: ViewportStageProps) {
  // Zoom is view state, so it deliberately stays out of the persisted project.
  const [zoom, setZoom] = useState(100);
  const safePerspective = clampNumber(perspective, PERSPECTIVE_LIMITS.min, PERSPECTIVE_LIMITS.max, 800);
  const targetTransform = useMemo(() => composeTransformCSS(properties.transform), [properties.transform]);

  return (
    <section className={cn('panel-surface flex min-h-[38dvh] flex-col', className)} aria-label="Animation preview stage">
      <div className="flex flex-wrap items-center gap-2 border-b border-obsidian-700/60 p-2">
        <Select
          value={shape}
          options={SHAPE_OPTIONS}
          onChange={(value) => onPreviewChange({ shape: value }, true)}
          label="Element"
          size="sm"
          className="w-36"
          disabled={disabled}
        />
        <Select
          value={preview.viewportBackground}
          options={BACKGROUND_OPTIONS}
          onChange={(value) => onPreviewChange({ viewportBackground: value }, true)}
          label="Backdrop"
          size="sm"
          className="w-40"
          disabled={disabled}
        />

        <div className="ml-auto flex items-center gap-1">
          <Tooltip content="Toggle the perspective floor and horizon guides">
            <Button
              variant={preview.showPerspectiveGuide ? 'secondary' : 'ghost'}
              size="icon-sm"
              iconLeft={Grid3x3}
              onClick={() => onPreviewChange({ showPerspectiveGuide: !preview.showPerspectiveGuide }, true)}
              disabled={disabled}
              ariaLabel="Toggle perspective guide"
              aria-pressed={preview.showPerspectiveGuide}
            />
          </Tooltip>
          <Tooltip content="Reset the viewport to 100% and 800px perspective">
            <Button
              variant="ghost"
              size="icon-sm"
              iconLeft={RotateCcw}
              onClick={() => {
                setZoom(100);
                onPerspectiveChange(800);
              }}
              disabled={disabled}
              ariaLabel="Reset viewport"
            />
          </Tooltip>
        </div>
      </div>

      <div
        className={cn(
          'relative flex-1 overflow-hidden',
          BACKGROUND_CLASSES[preview.viewportBackground],
          isPlaying && 'after:pointer-events-none after:absolute after:inset-0 after:ring-1 after:ring-studio-accent/20',
        )}
        style={{ perspective: `${safePerspective}px` }}
      >
        <Visualizers3D
          perspective={safePerspective}
          showAxes={preview.showAxes}
          showPerspectiveGuide={preview.showPerspectiveGuide}
          enableMotionTrails={preview.enableMotionTrails}
          trailSamples={trailSamples}
          stageLightingIntensity={preview.stageLightingIntensity}
        />

        <div
          className="relative flex size-full items-center justify-center"
          style={{ transform: `scale(${zoom / 100})` }}
        >
          <div className="relative" style={{ transformStyle: 'preserve-3d' }}>
            <TargetGeometry
              ref={targetRef}
              shape={shape}
              properties={properties}
              customSvgContent={preview.customSvgContent}
              dimmed={disabled}
            />
            <TransformGizmo
              value={properties.transform}
              mode={gizmoMode}
              show3d={enable3dGizmo}
              keyframe={activeKeyframe}
              onChange={onTransformChange}
              disabled={disabled || isPlaying}
            />
          </div>
        </div>

        {isPlaying ? (
          <p className="readout absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-obsidian-950/80 px-2 py-1 text-[9px] text-studio-accent">
            Playing · {targetTransform}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2 border-t border-obsidian-700/60 p-2 sm:grid-cols-2">
        <Slider
          label="Perspective"
          value={perspective}
          min={PERSPECTIVE_LIMITS.min}
          max={PERSPECTIVE_LIMITS.max}
          step={PERSPECTIVE_LIMITS.step}
          onChange={onPerspectiveChange}
          formatValue={(value) => `${Math.round(value)}px`}
          disabled={disabled}
        />
        <Slider
          label="Zoom"
          value={zoom}
          min={ZOOM_LIMITS.min}
          max={ZOOM_LIMITS.max}
          step={ZOOM_LIMITS.step}
          onChange={setZoom}
          formatValue={(value) => `${Math.round(value)}%`}
          disabled={disabled}
        />
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Switch
            checked={preview.showAxes}
            onCheckedChange={(checked) => onPreviewChange({ showAxes: checked }, true)}
            label="Axes"
            disabled={disabled}
            className="min-w-24"
          />
          <Switch
            checked={preview.enableMotionTrails}
            onCheckedChange={(checked) => onPreviewChange({ enableMotionTrails: checked }, true)}
            label="Motion trails"
            disabled={disabled}
            className="min-w-32"
          />
          <div className="ml-auto flex items-center gap-2">
            <Maximize2 width={13} height={13} aria-hidden="true" className="text-zinc-400" />
            <Slider
              label="Stage light"
              value={preview.stageLightingIntensity}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => onPreviewChange({ stageLightingIntensity: value }, false)}
              onCommit={(value) => onPreviewChange({ stageLightingIntensity: value }, true)}
              formatValue={(value) => `${Math.round(value * 100)}%`}
              disabled={disabled}
              className="w-40"
              ariaLabel="Stage lighting intensity"
            />
          </div>
        </div>
      </div>

      <p className="readout flex items-center gap-1.5 border-t border-obsidian-700/60 px-2 py-1 text-[9px] text-zinc-400">
        <Scan width={12} height={12} aria-hidden="true" />
        {enable3dGizmo ? 'Full 3D gimbal active' : 'Simplified 2D gizmo'} · drag the gizmo to edit the active keyframe
      </p>
    </section>
  );
}
