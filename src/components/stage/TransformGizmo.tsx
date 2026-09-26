'use client';

import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/cn';
import { composeTransformCSS } from '@/lib/cssGenerator';
import {
  TRANSFORM_LIMITS,
  clampNumber,
  type KeyframePoint,
  type TransformProperties,
} from '@/types/sandbox';

export type GizmoMode = 'translate' | 'rotate' | 'off';

export interface TransformGizmoProps {
  /** Transform of the keyframe the gizmo edits. */
  value: TransformProperties;
  /** Active gizmo tool. */
  mode: GizmoMode;
  /** True when the timeline has 3D rotation and the full gimbal may show. */
  show3d?: boolean;
  /** Keyframe currently being edited, used for the numeric readout. */
  keyframe?: KeyframePoint | null;
  /** Timeline name shown in the readout when no keyframe is supplied. */
  timelineName?: string;
  /** Fires continuously while dragging; `commit` is true on release. */
  onChange: (patch: Partial<TransformProperties>, commit: boolean) => void;
  disabled?: boolean;
  className?: string;
}

type GizmoHandle = 'translate' | 'rotate' | 'reset';

const RING_RADIUS = 74;
const STAGE_HALF_SIZE = 128;
const DRAG_THRESHOLD_PX = 2;

/**
 * Direct-manipulation transform gizmo.
 *
 * The outer ring drags `rotateZ` from the pointer angle and the axis cross
 * drags translation in stage pixels. Both gesture kinds emit `commit: false`
 * while moving and `commit: true` on release, which the history layer records
 * as a single undo entry. Pointer capture keeps the drag alive outside the
 * handle, and every handle is also a focusable slider with arrow-key steps.
 */
export function TransformGizmo({
  value,
  mode,
  show3d = true,
  keyframe = null,
  timelineName,
  onChange,
  disabled = false,
  className,
}: TransformGizmoProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeHandle, setActiveHandle] = useState<GizmoHandle | null>(null);
  const dragStateRef = useRef<{ handle: GizmoHandle; originX: number; originY: number; clientX: number; clientY: number; moved: boolean } | null>(
    null,
  );

  const transformCSS = useMemo(() => composeTransformCSS(value), [value]);

  const toLocalPoint = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
      return {
        x: ((clientX - rect.left) / rect.width) * STAGE_HALF_SIZE * 2 - STAGE_HALF_SIZE,
        y: ((clientY - rect.top) / rect.height) * STAGE_HALF_SIZE * 2 - STAGE_HALF_SIZE,
      };
    },
    [],
  );

  const clampTranslate = useCallback(
    (value: number, key: 'translateX' | 'translateY'): number =>
      clampNumber(value, TRANSFORM_LIMITS[key].min, TRANSFORM_LIMITS[key].max, 0),
    [],
  );

  const handlePointerDown = useCallback(
    (handle: GizmoHandle, event: ReactPointerEvent<SVGElement>) => {
      if (disabled) return;
      event.stopPropagation();
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Best effort: the move handler still receives pointer events.
      }
      dragStateRef.current = {
        handle,
        originX: value.translateX,
        originY: value.translateY,
        clientX: event.clientX,
        clientY: event.clientY,
        moved: false,
      };
      setActiveHandle(handle);
    },
    [disabled, value.translateX, value.translateY],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGElement>) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const dx = event.clientX - drag.clientX;
      const dy = event.clientY - drag.clientY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;

      if (drag.handle === 'translate') {
        // One SVG unit is one stage pixel, so the drag maps 1:1 to translateX/Y.
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0) return;
        const scale = (STAGE_HALF_SIZE * 2) / rect.width;
        onChange(
          {
            translateX: clampTranslate(drag.originX + dx * scale, 'translateX'),
            translateY: clampTranslate(drag.originY + dy * scale, 'translateY'),
          },
          false,
        );
        return;
      }

      if (drag.handle === 'rotate') {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0) return;
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const startAngle = (Math.atan2(drag.clientY - centerY, drag.clientX - centerX) * 180) / Math.PI;
        const currentAngle = (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI;
        let next = drag.originX + (currentAngle - startAngle);
        if (event.shiftKey) next = Math.round(next / 15) * 15;
        onChange(
          { rotateZ: clampNumber(next, TRANSFORM_LIMITS.rotateZ.min, TRANSFORM_LIMITS.rotateZ.max, value.rotateZ) },
          false,
        );
      }
    },
    [clampTranslate, onChange, value.rotateZ],
  );

  const endDrag = useCallback(
    (event: ReactPointerEvent<SVGElement>) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      dragStateRef.current = null;
      setActiveHandle(null);
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // The capture may already have been released by the browser.
      }
      if (!drag.moved) return;
      // A single committed patch closes the gesture opened on pointer down.
      if (drag.handle === 'translate') {
        onChange({ translateX: value.translateX, translateY: value.translateY }, true);
      } else if (drag.handle === 'rotate') {
        onChange({ rotateZ: value.rotateZ }, true);
      }
    },
    [onChange, value.rotateX, value.rotateY, value.rotateZ, value.translateX, value.translateY],
  );

  const handleKeyDown = useCallback(
    (handle: GizmoHandle, event: KeyboardEvent<SVGElement>) => {
      if (disabled) return;
      const step = event.shiftKey ? 15 : 1;
      if (handle === 'translate') {
        let patch: Partial<TransformProperties> | null = null;
        if (event.key === 'ArrowLeft') patch = { translateX: clampTranslate(value.translateX - step, 'translateX') };
        if (event.key === 'ArrowRight') patch = { translateX: clampTranslate(value.translateX + step, 'translateX') };
        if (event.key === 'ArrowUp') patch = { translateY: clampTranslate(value.translateY - step, 'translateY') };
        if (event.key === 'ArrowDown') patch = { translateY: clampTranslate(value.translateY + step, 'translateY') };
        if (!patch) return;
        event.preventDefault();
        onChange(patch, true);
        return;
      }
      if (handle === 'rotate') {
        let next: number | null = null;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = value.rotateZ - step;
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = value.rotateZ + step;
        if (next === null) return;
        event.preventDefault();
        onChange({ rotateZ: clampNumber(next, TRANSFORM_LIMITS.rotateZ.min, TRANSFORM_LIMITS.rotateZ.max, value.rotateZ) }, true);
      }
    },
    [clampTranslate, disabled, onChange, value.rotateZ, value.translateX, value.translateY],
  );

  if (mode === 'off' || disabled) return null;

  const isDragging = (handle: GizmoHandle): boolean => activeHandle === handle;
  const transformLabel = keyframe
    ? `Keyframe at ${keyframe.offset}%`
    : timelineName
      ? `Timeline: ${timelineName}`
      : 'Transform gizmo';

  return (
    <div className={cn('pointer-events-none absolute inset-0 select-none', className)} data-testid="transform-gizmo">
      <svg
        ref={svgRef}
        viewBox={`${-STAGE_HALF_SIZE} ${-STAGE_HALF_SIZE} ${STAGE_HALF_SIZE * 2} ${STAGE_HALF_SIZE * 2}`}
        className="h-full w-full"
        role="group"
        aria-label="Transform gizmo"
      >
        {mode === 'translate' ? (
          <g className="pointer-events-auto">
            <line x1={-STAGE_HALF_SIZE} y1={0} x2={STAGE_HALF_SIZE} y2={0} stroke="#00f5d4" strokeOpacity={0.35} strokeWidth={1} />
            <line x1={0} y1={-STAGE_HALF_SIZE} x2={0} y2={STAGE_HALF_SIZE} stroke="#00f5d4" strokeOpacity={0.35} strokeWidth={1} />
            <g
              role="button"
              tabIndex={0}
              aria-label="Drag to translate on X and Y"
              aria-describedby="gizmo-readout"
              onPointerDown={(event) => handlePointerDown('translate', event)}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={(event) => handleKeyDown('translate', event)}
              className="cursor-move outline-none focus-visible:opacity-100"
            >
              <rect
                x={-28}
                y={-28}
                width={56}
                height={56}
                rx={8}
                fill="#00f5d4"
                fillOpacity={isDragging('translate') ? 0.22 : 0.1}
                stroke="#00f5d4"
                strokeWidth={isDragging('translate') ? 1.5 : 1}
                strokeDasharray="4 3"
              />
              <path d="M -12 0 L -5 0 M 12 0 L 5 0 M 0 -12 L 0 -5 M 0 12 L 0 5" stroke="#00f5d4" strokeWidth={1.5} strokeLinecap="round" />
            </g>
          </g>
        ) : null}

        {mode === 'rotate' ? (
          <g className="pointer-events-auto">
            <circle cx={0} cy={0} r={RING_RADIUS} fill="none" stroke="#a855f7" strokeOpacity={0.15} strokeWidth={6} />
            <g
              role="button"
              tabIndex={0}
              aria-label="Drag to rotate around Z"
              aria-describedby="gizmo-readout"
              aria-valuemin={TRANSFORM_LIMITS.rotateZ.min}
              aria-valuemax={TRANSFORM_LIMITS.rotateZ.max}
              aria-valuenow={value.rotateZ}
              aria-valuetext={`${value.rotateZ} degrees`}
              onPointerDown={(event) => handlePointerDown('rotate', event)}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={(event) => handleKeyDown('rotate', event)}
              className="cursor-alias outline-none focus-visible:opacity-100"
            >
              <circle
                cx={0}
                cy={0}
                r={RING_RADIUS}
                fill="none"
                stroke="#a855f7"
                strokeWidth={2}
                strokeDasharray="6 5"
                opacity={isDragging('rotate') ? 1 : 0.7}
              />
              {show3d ? (
                <ellipse cx={0} cy={0} rx={RING_RADIUS} ry={RING_RADIUS * 0.34} fill="none" stroke="#a855f7" strokeOpacity={0.45} strokeWidth={1} />
              ) : null}
              <circle cx={0} cy={-RING_RADIUS} r={4} fill="#a855f7" />
            </g>
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={-RING_RADIUS}
              stroke="#a855f7"
              strokeWidth={1.5}
              transform={`rotate(${value.rotateZ})`}
            />
          </g>
        ) : null}
      </svg>

      <p id="gizmo-readout" className="readout pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-obsidian-950/85 px-2 py-1 text-[9px] whitespace-nowrap text-zinc-400">
        <span className="text-studio-accent">{transformLabel}</span>
        {' · '}
        {value.translateX}
        {value.translateUnit} / {value.translateY}
        {value.translateUnit} · {value.rotateZ}°
        {' · '}
        {transformCSS}
      </p>
    </div>
  );
}
