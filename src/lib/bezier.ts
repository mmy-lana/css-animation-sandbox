/**
 * Cubic bezier mathematics for the keyframe easing editor.
 *
 * A CSS `cubic-bezier(x1, y1, x2, y2)` curve is the parametric curve
 *
 *   B(t) = 3(1 - t)²t · P1 + 3(1 - t)t² · P2 + t³        for t ∈ [0, 1]
 *
 * with P0 = (0, 0) and P3 = (1, 1). Because the X axis is time, the editor has
 * to invert B(t) to find `t` for a given X before it can read the Y value;
 * {@link solveCubicBezierTimeForX} implements that inversion with
 * Newton-Raphson and a bisection fallback (the same strategy WebKit uses).
 *
 * This module is **server-safe and pure**: no DOM, no timers, no side effects.
 */

import {
  DEFAULT_CUBIC_BEZIER,
  clampNumber,
  type CubicBezierPoints,
  type TimingPreset,
  type ValidationError,
  validateBezierCoords,
} from '@/types/sandbox';

// ---------------------------------------------------------------------------
// Named preset coordinates
// ---------------------------------------------------------------------------

export type NamedTimingPreset = Exclude<TimingPreset, 'custom-cubic'>;

/**
 * Control points for every CSS keyword timing function. `step-start` and
 * `step-end` are modelled as their cubic-bézier equivalents so the editor can
 * display a curve for them without special-casing the renderer.
 */
export const UNIT_BEZIER_PRESETS: Readonly<Record<NamedTimingPreset, Readonly<CubicBezierPoints>>> = Object.freeze({
  linear: Object.freeze({ x1: 0, y1: 0, x2: 1, y2: 1 }),
  ease: Object.freeze({ x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }),
  'ease-in': Object.freeze({ x1: 0.42, y1: 0, x2: 1, y2: 1 }),
  'ease-out': Object.freeze({ x1: 0, y1: 0, x2: 0.58, y2: 1 }),
  'ease-in-out': Object.freeze({ x1: 0.42, y1: 0, x2: 0.58, y2: 1 }),
  'step-start': Object.freeze({ x1: 0, y1: 0, x2: 1, y2: 0 }),
  'step-end': Object.freeze({ x1: 0, y1: 1, x2: 1, y2: 1 }),
});

export interface BezierSamplePoint {
  x: number;
  y: number;
}

export interface BezierPlotBox {
  width: number;
  height: number;
  padding: number;
}

export const DEFAULT_BEZIER_PLOT_BOX: Readonly<BezierPlotBox> = Object.freeze({
  width: 200,
  height: 200,
  padding: 16,
});

// ---------------------------------------------------------------------------
// Core 1D curve evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluates the unit cubic bezier polynomial for a single axis.
 * `p1`/`p2` are the control values of that axis; the endpoints are 0 and 1.
 */
export function cubicBezierCoordinateAt(t: number, p1: number, p2: number): number {
  const clampedT = clampNumber(t, 0, 1, 0);
  const inverse = 1 - clampedT;
  const inverseSquared = inverse * inverse;
  const tSquared = clampedT * clampedT;
  return 3 * inverseSquared * clampedT * p1 + 3 * inverse * tSquared * p2 + tSquared * clampedT;
}

/** First derivative of {@link cubicBezierCoordinateAt} with respect to `t`. */
export function cubicBezierSlopeAt(t: number, p1: number, p2: number): number {
  const clampedT = clampNumber(t, 0, 1, 0);
  const inverse = 1 - clampedT;
  return 3 * inverse * inverse * p1 + 6 * inverse * clampedT * (p2 - p1) + 3 * clampedT * clampedT * (1 - p2);
}

// ---------------------------------------------------------------------------
// X → t inversion and curve sampling
// ---------------------------------------------------------------------------

const NEWTON_ITERATIONS = 8;
const NEWTON_MIN_SLOPE = 0.001;
const SUBDIVISION_PRECISION = 1e-7;
const SUBDIVISION_MAX_ITERATIONS = 20;

/**
 * Inverts the X component of the curve: finds `t` such that
 * `cubicBezierCoordinateAt(t, x1, x2) === targetX`.
 *
 * Newton-Raphson converges in a couple of steps for well-conditioned curves;
 * a flat or overshooting curve falls back to bisection so the editor never
 * produces NaN. The result is always clamped to `[0, 1]`.
 */
export function solveCubicBezierTimeForX(targetX: number, bezier: CubicBezierPoints): number {
  const x = clampNumber(targetX, 0, 1, 0);
  if (x === 0) return 0;
  if (x === 1) return 1;

  // Initial guess: linear interpolation between the endpoints.
  let t = x;

  for (let iteration = 0; iteration < NEWTON_ITERATIONS; iteration += 1) {
    const slope = cubicBezierSlopeAt(t, bezier.x1, bezier.x2);
    if (Math.abs(slope) < NEWTON_MIN_SLOPE) break;
    const error = cubicBezierCoordinateAt(t, bezier.x1, bezier.x2) - x;
    if (Math.abs(error) < SUBDIVISION_PRECISION) return clampNumber(t, 0, 1, x);

    t -= error / slope;
    if (!Number.isFinite(t) || t < 0 || t > 1) break;
  }

  // Bisection fallback over a progressively refined bracket.
  let low = 0;
  let high = 1;
  t = x;
  for (let iteration = 0; iteration < SUBDIVISION_MAX_ITERATIONS; iteration += 1) {
    const error = cubicBezierCoordinateAt(t, bezier.x1, bezier.x2) - x;
    if (Math.abs(error) < SUBDIVISION_PRECISION) break;

    if (error > 0) {
      high = t;
    } else {
      low = t;
    }
    t = (low + high) / 2;
  }

  return clampNumber(t, 0, 1, x);
}

/** Returns the curve point at a given X (i.e. the eased progress at `x`). */
export function pointOnCubicBezier(x: number, bezier: CubicBezierPoints): BezierSamplePoint {
  const clampedX = clampNumber(x, 0, 1, 0);
  const t = solveCubicBezierTimeForX(clampedX, bezier);
  return { x: clampedX, y: cubicBezierCoordinateAt(t, bezier.y1, bezier.y2) };
}

/**
 * Tangent angle in degrees at a given X. Vertical tangents (zero horizontal
 * slope) resolve to ±90° instead of `Infinity` so the gizmo can render them.
 */
export function tangentAngleOnCubicBezier(x: number, bezier: CubicBezierPoints): number {
  const clampedX = clampNumber(x, 0, 1, 0);
  const t = solveCubicBezierTimeForX(clampedX, bezier);
  const dx = cubicBezierSlopeAt(t, bezier.x1, bezier.x2);
  const dy = cubicBezierSlopeAt(t, bezier.y1, bezier.y2);

  if (Math.abs(dx) < 1e-6) {
    return dy >= 0 ? 90 : -90;
  }
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** Samples the curve evenly in X for polyline rendering and hit testing. */
export function sampleCubicBezier(
  bezier: CubicBezierPoints,
  sampleCount = 48,
  yRange: { min: number; max: number } = { min: -1, max: 2 },
): BezierSamplePoint[] {
  const count = Math.max(2, Math.floor(sampleCount));
  const samples: BezierSamplePoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const x = index / (count - 1);
    const y = pointOnCubicBezier(x, bezier).y;
    samples.push({ x, y: clampNumber(y, yRange.min, yRange.max, y) });
  }
  return samples;
}

// ---------------------------------------------------------------------------
// Unit-space ↔ SVG plot-space mapping
// ---------------------------------------------------------------------------

/**
 * Maps a unit-space point (X right, **Y up**) into SVG coordinates
 * (X right, **Y down**) inside `box`. The mapping is affine with a flip, so an
 * exact cubic control polygon stays an exact cubic control polygon.
 */
export function mapUnitToPlot(point: BezierSamplePoint, box: BezierPlotBox): BezierSamplePoint {
  const innerWidth = Math.max(box.width - box.padding * 2, 0);
  const innerHeight = Math.max(box.height - box.padding * 2, 0);
  return {
    x: roundTo3(box.padding + point.x * innerWidth),
    y: roundTo3(box.padding + (1 - point.y) * innerHeight),
  };
}

/** Inverse of {@link mapUnitToPlot}, used when dragging a bezier handle. */
export function mapPlotToUnit(point: BezierSamplePoint, box: BezierPlotBox): BezierSamplePoint {
  const innerWidth = Math.max(box.width - box.padding * 2, 0);
  const innerHeight = Math.max(box.height - box.padding * 2, 0);
  if (innerWidth === 0 || innerHeight === 0) {
    return { x: 0, y: 0 };
  }
  return {
    // X is time and must stay inside [0, 1]; Y is allowed to overshoot.
    x: clampNumber((point.x - box.padding) / innerWidth, 0, 1, 0),
    y: (box.height - box.padding - point.y) / innerHeight,
  };
}

function roundTo3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Exact cubic path command for the curve inside `box`. */
export function buildCubicBezierPathD(bezier: CubicBezierPoints, box: BezierPlotBox = DEFAULT_BEZIER_PLOT_BOX): string {
  const start = mapUnitToPlot({ x: 0, y: 0 }, box);
  const control1 = mapUnitToPlot({ x: bezier.x1, y: bezier.y1 }, box);
  const control2 = mapUnitToPlot({ x: bezier.x2, y: bezier.y2 }, box);
  const end = mapUnitToPlot({ x: 1, y: 1 }, box);
  return `M ${start.x} ${start.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${end.x} ${end.y}`;
}

/** Polyline approximation of the curve, used for glow/shadow underlays. */
export function buildCubicBezierPolylineD(
  bezier: CubicBezierPoints,
  box: BezierPlotBox = DEFAULT_BEZIER_PLOT_BOX,
  sampleCount = 48,
): string {
  return sampleCubicBezier(bezier, sampleCount)
    .map((sample, index) => {
      const mapped = mapUnitToPlot(sample, box);
      return `${index === 0 ? 'M' : 'L'} ${mapped.x} ${mapped.y}`;
    })
    .join(' ');
}

/** Handles for the editor overlay: anchor → P1 and P2 → anchor. */
export interface CubicBezierHandleGeometry {
  start: BezierSamplePoint;
  control1: BezierSamplePoint;
  control2: BezierSamplePoint;
  end: BezierSamplePoint;
  firstHandlePathD: string;
  secondHandlePathD: string;
}

export function buildCubicBezierHandleGeometry(
  bezier: CubicBezierPoints,
  box: BezierPlotBox = DEFAULT_BEZIER_PLOT_BOX,
): CubicBezierHandleGeometry {
  const start = mapUnitToPlot({ x: 0, y: 0 }, box);
  const control1 = mapUnitToPlot({ x: bezier.x1, y: bezier.y1 }, box);
  const control2 = mapUnitToPlot({ x: bezier.x2, y: bezier.y2 }, box);
  const end = mapUnitToPlot({ x: 1, y: 1 }, box);

  return {
    start,
    control1,
    control2,
    end,
    firstHandlePathD: `M ${start.x} ${start.y} L ${control1.x} ${control1.y}`,
    secondHandlePathD: `M ${end.x} ${end.y} L ${control2.x} ${control2.y}`,
  };
}

// ---------------------------------------------------------------------------
// Preset resolution, formatting and validation
// ---------------------------------------------------------------------------

export function createCubicBezier(x1: number, y1: number, x2: number, y2: number): CubicBezierPoints {
  return { x1, y1, x2, y2 };
}

export function cloneCubicBezier(bezier: CubicBezierPoints): CubicBezierPoints {
  return { x1: bezier.x1, y1: bezier.y1, x2: bezier.x2, y2: bezier.y2 };
}

export function cubicBezierEquals(a: CubicBezierPoints, b: CubicBezierPoints, epsilon = 0.001): boolean {
  return (
    Math.abs(a.x1 - b.x1) <= epsilon &&
    Math.abs(a.y1 - b.y1) <= epsilon &&
    Math.abs(a.x2 - b.x2) <= epsilon &&
    Math.abs(a.y2 - b.y2) <= epsilon
  );
}

/** Returns the bezier control points implied by a timing preset. */
export function resolveTimingBezier(timing: TimingPreset, bezier?: CubicBezierPoints): CubicBezierPoints {
  if (timing === 'custom-cubic') {
    return cloneCubicBezier(bezier ?? DEFAULT_CUBIC_BEZIER);
  }
  return cloneCubicBezier(UNIT_BEZIER_PRESETS[timing]);
}

/** Reverse lookup: recognises when the control points match a named preset. */
export function detectTimingPreset(bezier: CubicBezierPoints, epsilon = 0.001): TimingPreset {
  const entries = Object.entries(UNIT_BEZIER_PRESETS) as Array<[NamedTimingPreset, Readonly<CubicBezierPoints>]>;
  for (const [preset, presetBezier] of entries) {
    if (cubicBezierEquals(bezier, presetBezier, epsilon)) return preset;
  }
  return 'custom-cubic';
}

/** Formats control points as a CSS `cubic-bezier(...)` expression. */
export function formatCubicBezier(bezier: CubicBezierPoints, precision = 2): string {
  const format = (value: number): string => {
    const safe = Number.isFinite(value) ? value : 0;
    return safe.toFixed(precision).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '.0');
  };
  return `cubic-bezier(${format(bezier.x1)}, ${format(bezier.y1)}, ${format(bezier.x2)}, ${format(bezier.y2)})`;
}

/**
 * True when the curve is functionally equivalent to a step or a straight line.
 * The editor uses this to hint that a keyword timing function would be clearer;
 * it is *not* an error, since `cubic-bezier(0, 0, 1, 1)` is valid CSS.
 */
export function isDegenerateBezier(bezier: CubicBezierPoints, epsilon = 0.0001): boolean {
  return (
    cubicBezierEquals(bezier, UNIT_BEZIER_PRESETS.linear, epsilon) ||
    cubicBezierEquals(bezier, UNIT_BEZIER_PRESETS['step-start'], epsilon) ||
    cubicBezierEquals(bezier, UNIT_BEZIER_PRESETS['step-end'], epsilon)
  );
}

/**
 * Hard validation for bezier coordinates: finite numbers plus X handles inside
 * `[0, 1]`. Keeping X in range also guarantees the X component of the curve is
 * monotonic, which is what makes {@link solveCubicBezierTimeForX} well defined.
 */
export function validateCubicBezier(bezier: CubicBezierPoints): ValidationError[] {
  const errors: ValidationError[] = [...validateBezierCoords(bezier)];

  if (!Number.isFinite(bezier.x1) || !Number.isFinite(bezier.x2)) {
    errors.push({ field: 'bezier', message: 'Handle X coordinates must be finite numbers.' });
  }
  if (!Number.isFinite(bezier.y1) || !Number.isFinite(bezier.y2)) {
    errors.push({ field: 'bezier', message: 'Handle Y coordinates must be finite numbers.' });
  }

  return errors;
}
