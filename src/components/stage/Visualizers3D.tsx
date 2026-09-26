'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import { clampNumber } from '@/types/sandbox';

export interface Visualizers3DProps {
  /** Viewport perspective in pixels; 0 collapses to an orthographic view. */
  perspective: number;
  /** Draws the X/Y axes through the target origin. */
  showAxes: boolean;
  /** Draws the perspective floor and horizon guides. */
  showPerspectiveGuide: boolean;
  /** Echoes the previous transform positions as fading motion trails. */
  enableMotionTrails: boolean;
  /** Most recent transform strings, newest last; used for the trail. */
  trailSamples?: readonly string[];
  /** Lighting intensity 0…1, drawn as a radial vignette over the floor. */
  stageLightingIntensity: number;
  disabled?: boolean;
  className?: string;
}

const TRAIL_LIMIT = 6;
const GRID_SIZE = 900;
const GRID_COLUMNS = 22;

/**
 * Non-interactive stage overlays: axis guides, the perspective floor and the
 * motion-trail echo of the target's recent transforms.
 *
 * Everything is `pointer-events-none` and `aria-hidden`, because these are
 * affordances for the animation, not controls — the gizmo above them is the
 * only pointer surface on the stage.
 */
export function Visualizers3D({
  perspective,
  showAxes,
  showPerspectiveGuide,
  enableMotionTrails,
  trailSamples = [],
  stageLightingIntensity,
  disabled = false,
  className,
}: Visualizers3DProps) {
  const safePerspective = clampNumber(perspective, 0, 4000, 800);
  const lighting = clampNumber(stageLightingIntensity, 0, 1, 0.65);
  const trails = useMemo(() => trailSamples.slice(-TRAIL_LIMIT), [trailSamples]);

  if (disabled) return null;

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden="true">
      {showPerspectiveGuide ? (
        <div
          className="absolute inset-x-0 bottom-0 h-1/2"
          style={{ perspective: `${safePerspective}px`, transform: `rotateX(62deg) translateY(18%)` }}
        >
          <div
            className="size-full origin-bottom"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(0, 245, 212, 0.09) 1px, transparent 1px),
                linear-gradient(to top, rgba(0, 245, 212, 0.09) 1px, transparent 1px)
              `,
              backgroundSize: `${GRID_SIZE / GRID_COLUMNS}px ${GRID_SIZE / GRID_COLUMNS}px`,
              maskImage: 'linear-gradient(to top, black, transparent 85%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 40%, rgba(0, 245, 212, ${0.05 + lighting * 0.12}), transparent 70%)`,
            }}
          />
        </div>
      ) : null}

      {showAxes ? (
        <>
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-linear-to-b from-transparent via-studio-accent/25 to-transparent" />
          <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-linear-to-r from-transparent via-studio-violet/25 to-transparent" />
          <span className="readout absolute bottom-2 right-3 text-[9px] text-studio-accent/60">X</span>
          <span className="readout absolute top-2 left-3 text-[9px] text-studio-violet-soft/60">Y</span>
        </>
      ) : null}

      {enableMotionTrails && trails.length > 0 ? (
        <ul className="absolute inset-0">
          {trails.map((transform, index) => {
            const age = index / trails.length;
            return (
              <li
                key={`${transform}-${index}`}
                className="absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-studio-accent"
                style={{
                  transform: `${transform} scale(${0.7 + age * 0.3})`,
                  opacity: 0.03 + age * 0.16,
                }}
              />
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
