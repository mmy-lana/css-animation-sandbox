'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { NumberInput } from '@/components/ui/NumberInput';
import {
  DEFAULT_BEZIER_PLOT_BOX,
  UNIT_BEZIER_PRESETS,
  buildCubicBezierHandleGeometry,
  buildCubicBezierPathD,
  buildCubicBezierPolylineD,
  detectTimingPreset,
  formatCubicBezier,
  isDegenerateBezier,
  mapPlotToUnit,
  mapUnitToPlot,
  validateCubicBezier,
  type NamedTimingPreset,
} from '@/lib/bezier';
import { DEFAULT_CUBIC_BEZIER, roundTo, type CubicBezierPoints } from '@/types/sandbox';

export interface BezierCurveEditorProps {
  bezier: CubicBezierPoints;
  onChange: (bezier: CubicBezierPoints) => void;
  disabled?: boolean;
  /** Renders the looping curve runner; disabled under reduced motion. */
  animatePreview?: boolean;
  className?: string;
}

type HandleId = 'p1' | 'p2';

const Y_LIMIT = { min: -2, max: 2, step: 0.01, defaultValue: 0 } as const;
const X_LIMIT = { min: 0, max: 1, step: 0.01, defaultValue: 0 } as const;
const PLOT = DEFAULT_BEZIER_PLOT_BOX;
const QUICK_PRESETS: readonly NamedTimingPreset[] = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end'];
const HANDLE_RADIUS = 6;

/** Restricts a control point to the range the editor advertises. */
function clampTo(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Interactive cubic-bezier editor.
 *
 * The canvas renders the exact control polygon in SVG space, and dragging a
 * handle inverts the affine unit↔plot mapping, so what is drawn is what CSS
 * will evaluate. Handles are also focusable sliders with arrow-key support,
 * which keeps the editor usable without a pointer.
 */
export function BezierCurveEditor({ bezier, onChange, disabled = false, animatePreview = true, className }: BezierCurveEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<HandleId | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const listener = (event: MediaQueryListEvent): void => setReducedMotion(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  const geometry = useMemo(() => buildCubicBezierHandleGeometry(bezier, PLOT), [bezier]);
  const pathD = useMemo(() => buildCubicBezierPathD(bezier, PLOT), [bezier]);
  const polylineD = useMemo(() => buildCubicBezierPolylineD(bezier, PLOT, 48), [bezier]);
  const errors = useMemo(() => validateCubicBezier(bezier), [bezier]);
  const degenerate = useMemo(() => isDegenerateBezier(bezier), [bezier]);
  const detected = useMemo(() => detectTimingPreset(bezier), [bezier]);

  const unitToPlot = useCallback(
    (x: number, y: number): { x: number; y: number } => {
      const plot = mapUnitToPlot({ x, y }, PLOT);
      return { x: plot.x, y: plot.y };
    },
    [],
  );

  const commit = useCallback(
    (next: CubicBezierPoints) => {
      if (disabled) return;
      // Every path — the SVG drag, the arrow keys, the numeric fields — funnels
      // through here, so this is the one place that guarantees a stored handle
      // stays inside the declared limits. The plot mapping clamps X but lets Y
      // overshoot, which would otherwise let a drag commit a value the number
      // inputs then display as out of range.
      onChange({
        x1: roundTo(clampTo(next.x1, X_LIMIT.min, X_LIMIT.max), 3),
        y1: roundTo(clampTo(next.y1, Y_LIMIT.min, Y_LIMIT.max), 3),
        x2: roundTo(clampTo(next.x2, X_LIMIT.min, X_LIMIT.max), 3),
        y2: roundTo(clampTo(next.y2, Y_LIMIT.min, Y_LIMIT.max), 3),
      });
    },
    [disabled, onChange],
  );

  const handleDrag = useCallback(
    (handle: HandleId, event: ReactPointerEvent<SVGCircleElement>) => {
      if (disabled) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      // Preserve the aspect ratio of the viewBox while mapping client pixels.
      const scale = rect.width / PLOT.width;
      const plotPoint = {
        x: (event.clientX - rect.left) / scale,
        y: (event.clientY - rect.top) / scale,
      };
      const unit = mapPlotToUnit(plotPoint, PLOT);
      commit(
        handle === 'p1'
          ? { ...bezier, x1: unit.x, y1: unit.y }
          : { ...bezier, x2: unit.x, y2: unit.y },
      );
    },
    [bezier, commit, disabled],
  );

  const handleKeyDown = useCallback(
    (handle: HandleId, event: KeyboardEvent<SVGCircleElement>) => {
      if (disabled) return;
      const step = event.shiftKey ? 0.1 : 0.01;
      const current = handle === 'p1' ? { x: bezier.x1, y: bezier.y1 } : { x: bezier.x2, y: bezier.y2 };
      let next: { x: number; y: number } | null = null;

      if (event.key === 'ArrowLeft') next = { x: current.x - step, y: current.y };
      if (event.key === 'ArrowRight') next = { x: current.x + step, y: current.y };
      if (event.key === 'ArrowUp') next = { x: current.x, y: current.y + step };
      if (event.key === 'ArrowDown') next = { x: current.x, y: current.y - step };
      if (next === null) return;

      event.preventDefault();
      const x = Math.min(Math.max(next.x, X_LIMIT.min), X_LIMIT.max);
      const y = Math.min(Math.max(next.y, Y_LIMIT.min), Y_LIMIT.max);
      commit(handle === 'p1' ? { ...bezier, x1: x, y1: y } : { ...bezier, x2: x, y2: y });
    },
    [bezier, commit, disabled],
  );

  const setField = useCallback(
    (field: keyof CubicBezierPoints, value: number) => {
      commit({ ...bezier, [field]: value });
    },
    [bezier, commit],
  );

  const unitBox = unitToPlot(0, 0);
  const unitTopRight = unitToPlot(1, 1);
  const gridLines = useMemo(() => [0.25, 0.5, 0.75], []);

  return (
    <div className={cn('space-y-3', className)} data-testid="bezier-curve-editor">
      <div className="flex items-center justify-between gap-2">
        <h3 id={titleId} className="text-[11px] font-semibold tracking-[0.08em] text-zinc-300 uppercase">
          Easing Curve
        </h3>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'readout rounded px-1.5 py-0.5 text-[9px] tracking-wide uppercase',
              detected === 'custom-cubic' ? 'bg-studio-violet/20 text-studio-violet-soft' : 'bg-obsidian-800 text-zinc-400',
            )}
          >
            {detected}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => commit({ ...DEFAULT_CUBIC_BEZIER })}
            aria-label="Reset curve to ease-in-out"
            title="Reset to ease-in-out"
            className="grid h-6 w-6 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-obsidian-800 hover:text-studio-accent disabled:pointer-events-none"
          >
            <RotateCcw width={12} height={12} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        className={cn(
          'relative overflow-hidden rounded-[10px] border border-obsidian-700 bg-obsidian-900',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
          role="img"
          aria-label={`Cubic bezier ${formatCubicBezier(bezier)}`}
          className="block h-auto w-full touch-none"
        >
          <defs>
            <linearGradient id={`${titleId}-fill`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00f5d4" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#7928ca" stopOpacity="0.18" />
            </linearGradient>
          </defs>

          {gridLines.map((ratio) => {
            const x = unitToPlot(ratio, 0).x;
            const y = unitToPlot(0, ratio).y;
            return (
              <g key={ratio} stroke="#27272a" strokeWidth={0.5}>
                <line x1={x} y1={PLOT.padding} x2={x} y2={PLOT.height - PLOT.padding} />
                <line x1={PLOT.padding} y1={y} x2={PLOT.width - PLOT.padding} y2={y} />
              </g>
            );
          })}

          <rect
            x={unitBox.x}
            y={unitTopRight.y}
            width={unitTopRight.x - unitBox.x}
            height={unitBox.y - unitTopRight.y}
            fill="#00f5d4"
            fillOpacity={0.03}
            stroke="#3f3f46"
            strokeWidth={0.75}
            strokeDasharray="2 2"
          />

          <path d={polylineD} fill="none" stroke="#52525b" strokeWidth={4} strokeLinecap="round" opacity={0.5} />
          <path d={pathD} fill="none" stroke={`url(#${titleId}-fill)`} strokeWidth={6} strokeLinecap="round" />
          <path d={pathD} fill="none" stroke="#00f5d4" strokeWidth={1.75} strokeLinecap="round" />

          <path d={geometry.firstHandlePathD} stroke="#a855f7" strokeWidth={1} strokeDasharray="3 2" />
          <path d={geometry.secondHandlePathD} stroke="#a855f7" strokeWidth={1} strokeDasharray="3 2" />

          <circle cx={geometry.start.x} cy={geometry.start.y} r={3} fill="#52525b" />
          <circle cx={geometry.end.x} cy={geometry.end.y} r={3} fill="#52525b" />

          {(['p1', 'p2'] as const).map((handle) => {
            const control = handle === 'p1' ? geometry.control1 : geometry.control2;
            const unit = handle === 'p1' ? { x: bezier.x1, y: bezier.y1 } : { x: bezier.x2, y: bezier.y2 };
            const active = dragging === handle;
            return (
              <circle
                key={handle}
                cx={control.x}
                cy={control.y}
                r={active ? HANDLE_RADIUS + 2 : HANDLE_RADIUS}
                fill={active ? '#5eead4' : '#00f5d4'}
                stroke="#09090b"
                strokeWidth={1.5}
                tabIndex={disabled ? -1 : 0}
                role="slider"
                aria-label={handle === 'p1' ? 'First control point' : 'Second control point'}
                aria-valuemin={handle === 'p1' ? X_LIMIT.min : Y_LIMIT.min}
                aria-valuemax={handle === 'p1' ? X_LIMIT.max : Y_LIMIT.max}
                aria-valuenow={Number((handle === 'p1' ? unit.x : unit.y).toFixed(2))}
                aria-valuetext={`x ${unit.x.toFixed(2)}, y ${unit.y.toFixed(2)}`}
                className="cursor-grab touch-none outline-none focus-visible:stroke-white active:cursor-grabbing"
                onPointerDown={(event) => {
                  if (disabled) return;
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDragging(handle);
                }}
                onPointerMove={(event) => {
                  if (dragging === handle) handleDrag(handle, event);
                }}
                onPointerUp={(event) => {
                  if (dragging !== handle) return;
                  setDragging(null);
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  handleDrag(handle, event);
                }}
                onKeyDown={(event) => handleKeyDown(handle, event)}
              />
            );
          })}

          {animatePreview && !reducedMotion ? (
            <circle r={3.5} fill="#fafafa">
              <animateMotion dur="1.8s" repeatCount="indefinite" path={pathD} />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;0.12;0.88;1"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </circle>
          ) : null}
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumberInput
          label="P1 X"
          value={bezier.x1}
          min={X_LIMIT.min}
          max={X_LIMIT.max}
          step={X_LIMIT.step}
          precision={2}
          disabled={disabled}
          onChange={(value) => setField('x1', value)}
        />
        <NumberInput
          label="P1 Y"
          value={bezier.y1}
          min={Y_LIMIT.min}
          max={Y_LIMIT.max}
          step={Y_LIMIT.step}
          precision={2}
          disabled={disabled}
          onChange={(value) => setField('y1', value)}
        />
        <NumberInput
          label="P2 X"
          value={bezier.x2}
          min={X_LIMIT.min}
          max={X_LIMIT.max}
          step={X_LIMIT.step}
          precision={2}
          disabled={disabled}
          onChange={(value) => setField('x2', value)}
        />
        <NumberInput
          label="P2 Y"
          value={bezier.y2}
          min={Y_LIMIT.min}
          max={Y_LIMIT.max}
          step={Y_LIMIT.step}
          precision={2}
          disabled={disabled}
          onChange={(value) => setField('y2', value)}
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {QUICK_PRESETS.map((preset) => {
          const active = detected === preset;
          return (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => commit({ ...UNIT_BEZIER_PRESETS[preset] })}
              className={cn(
                'rounded-md border px-1.5 py-0.5 text-[9px] tracking-wide transition-colors',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-accent',
                'disabled:pointer-events-none',
                active
                  ? 'border-studio-accent/60 bg-studio-accent/15 text-studio-accent'
                  : 'border-obsidian-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-100',
              )}
            >
              {preset}
            </button>
          );
        })}
      </div>

      {/* `formatCubicBezier` already returns the complete `cubic-bezier(...)`
          expression, so wrapping it in another literal produced
          `cubic-bezier(cubic-bezier(...))` on screen. */}
      <p className="readout text-[10px] text-zinc-400">{formatCubicBezier(bezier)}</p>

      {errors.length > 0 ? (
        <p role="alert" className="flex items-start gap-1 text-[10px] text-studio-danger">
          <TriangleAlert width={11} height={11} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{errors.map((error) => error.message).join(' ')}</span>
        </p>
      ) : degenerate ? (
        <p className="flex items-start gap-1 text-[10px] text-studio-warning">
          <TriangleAlert width={11} height={11} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>This curve is flat — the animation will hold its start value.</span>
        </p>
      ) : null}
    </div>
  );
}
