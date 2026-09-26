/**
 * Core domain model for the CSS Animation Sandbox.
 *
 * This module is a **server-safe pure module**: it contains no DOM access, no
 * React imports and no side effects at import time. Everything exported here is
 * either a type, an immutable data constant, a pure derivation or a validation
 * assertion, which makes it safe to import from `src/lib`, `src/hooks`,
 * `src/components` and `src/app` alike.
 *
 * Architecture rule enforced by this file: `src/types` must never import from
 * `src/lib`, `src/hooks`, `src/components` or `src/app`.
 */

// ---------------------------------------------------------------------------
// 1. Core entities
// ---------------------------------------------------------------------------

export type CSSPropertyUnit = 'px' | 'rem' | 'em' | '%' | 'deg' | 'turn' | 'rad' | 'vh' | 'vw';

export type TimingPreset =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'step-start'
  | 'step-end'
  | 'custom-cubic';

export type AnimationDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
export type AnimationFillMode = 'none' | 'forwards' | 'backwards' | 'both';
export type AnimationIteration = number | 'infinite';
export type PreviewElementShape = 'cube' | 'sphere' | 'card' | 'badge' | 'typography' | 'custom-svg';
export type ViewportBackground = 'grid-dark' | 'dots' | 'solid-obsidian' | 'checkerboard';

export interface CubicBezierPoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TransformProperties {
  translateX: number;
  translateY: number;
  /**
   * `translateZ` in CSS 3D transforms strictly represents physical depth in
   * pixels; its unit is fixed to `px` and is never taken from `translateUnit`.
   */
  translateZ: number;
  translateUnit: 'px' | '%' | 'rem';
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  skewX: number;
  skewY: number;
}

export interface FilterProperties {
  blur: number;
  brightness: number;
  contrast: number;
  grayscale: number;
  hueRotate: number;
  invert: number;
  opacity: number;
  saturate: number;
}

export interface StyleProperties {
  opacity: number;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  boxShadowX: number;
  boxShadowY: number;
  boxShadowBlur: number;
  boxShadowSpread: number;
  boxShadowColor: string;
  boxShadowInset: boolean;
  transformOriginX: number;
  transformOriginY: number;
}

export interface KeyframeProperties {
  transform: TransformProperties;
  filter: FilterProperties;
  styles: StyleProperties;
}

export interface KeyframePoint {
  id: string;
  offset: number;
  timingFunction: TimingPreset;
  bezier: CubicBezierPoints;
  properties: KeyframeProperties;
}

export interface AnimationTimeline {
  id: string;
  name: string;
  durationMs: number;
  delayMs: number;
  iterationCount: AnimationIteration;
  direction: AnimationDirection;
  fillMode: AnimationFillMode;
  keyframes: KeyframePoint[];
}

export interface PreviewConfig {
  shape: PreviewElementShape;
  customSvgContent?: string;
  viewportBackground: ViewportBackground;
  showAxes: boolean;
  showPerspectiveGuide: boolean;
  enableMotionTrails: boolean;
  stageLightingIntensity: number;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  activeTimelineId: string;
  timelines: AnimationTimeline[];
  preview: PreviewConfig;
  createdAt: number;
  updatedAt: number;
}

export type ExportTarget = 'vanilla-css' | 'tailwind-v4' | 'web-animations-api';

export interface ExportOptions {
  target: ExportTarget;
  animationClassName: string;
  keyframeRuleName: string;
  includeVendorPrefixes: boolean;
  includeVariables: boolean;
  prettify: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

// ---------------------------------------------------------------------------
// 2. Enumerated catalogues (drive UI selects without duplicating literals)
// ---------------------------------------------------------------------------

export const CSS_PROPERTY_UNITS: readonly CSSPropertyUnit[] = [
  'px',
  'rem',
  'em',
  '%',
  'deg',
  'turn',
  'rad',
  'vh',
  'vw',
] as const;

export const TRANSLATE_UNITS: readonly TransformProperties['translateUnit'][] = ['px', '%', 'rem'] as const;

export const TIMING_PRESETS: readonly TimingPreset[] = [
  'linear',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'step-start',
  'step-end',
  'custom-cubic',
] as const;

export const TIMING_PRESET_LABELS: Readonly<Record<TimingPreset, string>> = {
  linear: 'Linear',
  ease: 'Ease',
  'ease-in': 'Ease In',
  'ease-out': 'Ease Out',
  'ease-in-out': 'Ease In Out',
  'step-start': 'Step Start',
  'step-end': 'Step End',
  'custom-cubic': 'Custom Cubic Bezier',
};

export const ANIMATION_DIRECTIONS: readonly AnimationDirection[] = [
  'normal',
  'reverse',
  'alternate',
  'alternate-reverse',
] as const;

export const ANIMATION_DIRECTION_LABELS: Readonly<Record<AnimationDirection, string>> = {
  normal: 'Normal',
  reverse: 'Reverse',
  alternate: 'Alternate',
  'alternate-reverse': 'Alternate Reverse',
};

export const ANIMATION_FILL_MODES: readonly AnimationFillMode[] = ['none', 'forwards', 'backwards', 'both'] as const;

export const ANIMATION_FILL_MODE_LABELS: Readonly<Record<AnimationFillMode, string>> = {
  none: 'None',
  forwards: 'Forwards',
  backwards: 'Backwards',
  both: 'Both',
};

export const PREVIEW_ELEMENT_SHAPES: readonly PreviewElementShape[] = [
  'cube',
  'sphere',
  'card',
  'badge',
  'typography',
  'custom-svg',
] as const;

export const PREVIEW_ELEMENT_SHAPE_LABELS: Readonly<Record<PreviewElementShape, string>> = {
  cube: 'Cube',
  sphere: 'Sphere',
  card: 'Card',
  badge: 'Badge',
  typography: 'Typography',
  'custom-svg': 'Custom SVG',
};

export const VIEWPORT_BACKGROUNDS: readonly ViewportBackground[] = [
  'grid-dark',
  'dots',
  'solid-obsidian',
  'checkerboard',
] as const;

export const VIEWPORT_BACKGROUND_LABELS: Readonly<Record<ViewportBackground, string>> = {
  'grid-dark': 'Studio Grid',
  dots: 'Dot Matrix',
  'solid-obsidian': 'Solid Obsidian',
  checkerboard: 'Checkerboard',
};

export const EXPORT_TARGETS: readonly ExportTarget[] = [
  'vanilla-css',
  'tailwind-v4',
  'web-animations-api',
] as const;

export const EXPORT_TARGET_LABELS: Readonly<Record<ExportTarget, string>> = {
  'vanilla-css': 'Vanilla CSS',
  'tailwind-v4': 'Tailwind v4 @theme',
  'web-animations-api': 'Web Animations API',
};

/** Narrows an arbitrary string to a `TimingPreset` without a cast. */
export function isTimingPreset(value: unknown): value is TimingPreset {
  return typeof value === 'string' && (TIMING_PRESETS as readonly string[]).includes(value);
}

/** Narrows an arbitrary string to an `AnimationDirection` without a cast. */
export function isAnimationDirection(value: unknown): value is AnimationDirection {
  return typeof value === 'string' && (ANIMATION_DIRECTIONS as readonly string[]).includes(value);
}

/** Narrows an arbitrary string to an `AnimationFillMode` without a cast. */
export function isAnimationFillMode(value: unknown): value is AnimationFillMode {
  return typeof value === 'string' && (ANIMATION_FILL_MODES as readonly string[]).includes(value);
}

/** Narrows an arbitrary string to a `PreviewElementShape` without a cast. */
export function isPreviewElementShape(value: unknown): value is PreviewElementShape {
  return typeof value === 'string' && (PREVIEW_ELEMENT_SHAPES as readonly string[]).includes(value);
}

/** Narrows an arbitrary string to a `ViewportBackground` without a cast. */
export function isViewportBackground(value: unknown): value is ViewportBackground {
  return typeof value === 'string' && (VIEWPORT_BACKGROUNDS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// 3. Numeric limits — the single source of truth for sliders and validation
// ---------------------------------------------------------------------------

export interface NumericRange {
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

function range(min: number, max: number, step: number, defaultValue: number): NumericRange {
  return { min, max, step, defaultValue };
}

export const TIMELINE_LIMITS = {
  durationMs: range(16, 600_000, 10, 1_000),
  delayMs: range(0, 600_000, 10, 0),
  iterationCount: range(1, 1_000, 1, 1),
  offset: range(0, 100, 0.1, 0),
} as const;

export const TRANSFORM_LIMITS = {
  translateX: range(-2_000, 2_000, 1, 0),
  translateY: range(-2_000, 2_000, 1, 0),
  translateZ: range(-1_000, 1_000, 1, 0),
  rotateX: range(-1_800, 1_800, 1, 0),
  rotateY: range(-1_800, 1_800, 1, 0),
  rotateZ: range(-1_800, 1_800, 1, 0),
  scaleX: range(0, 10, 0.01, 1),
  scaleY: range(0, 10, 0.01, 1),
  scaleZ: range(0, 10, 0.01, 1),
  skewX: range(-180, 180, 0.5, 0),
  skewY: range(-180, 180, 0.5, 0),
} as const;

export const FILTER_LIMITS = {
  blur: range(0, 200, 0.5, 0),
  brightness: range(0, 400, 1, 100),
  contrast: range(0, 400, 1, 100),
  grayscale: range(0, 100, 1, 0),
  hueRotate: range(-360, 360, 1, 0),
  invert: range(0, 100, 1, 0),
  opacity: range(0, 100, 1, 100),
  saturate: range(0, 400, 1, 100),
} as const;

export const STYLE_LIMITS = {
  opacity: range(0, 1, 0.01, 1),
  borderWidth: range(0, 64, 1, 0),
  borderRadius: range(0, 999, 1, 16),
  boxShadowX: range(-999, 999, 1, 0),
  boxShadowY: range(-999, 999, 1, 12),
  boxShadowBlur: range(0, 999, 1, 40),
  boxShadowSpread: range(-999, 999, 1, 0),
  transformOriginX: range(-100, 200, 0.5, 50),
  transformOriginY: range(-100, 200, 0.5, 50),
} as const;

export const PREVIEW_LIMITS = {
  stageLightingIntensity: range(0, 1, 0.01, 0.65),
} as const;

// ---------------------------------------------------------------------------
// 4. Default values & factories
// ---------------------------------------------------------------------------

export const DEFAULT_CUBIC_BEZIER: Readonly<CubicBezierPoints> = Object.freeze({
  x1: 0.42,
  y1: 0,
  x2: 0.58,
  y2: 1,
});

export const DEFAULT_TRANSFORM_PROPERTIES: Readonly<TransformProperties> = Object.freeze({
  translateX: 0,
  translateY: 0,
  translateZ: 0,
  translateUnit: 'px',
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
  skewX: 0,
  skewY: 0,
});

export const DEFAULT_FILTER_PROPERTIES: Readonly<FilterProperties> = Object.freeze({
  blur: 0,
  brightness: 100,
  contrast: 100,
  grayscale: 0,
  hueRotate: 0,
  invert: 0,
  opacity: 100,
  saturate: 100,
});

export const DEFAULT_STYLE_PROPERTIES: Readonly<StyleProperties> = Object.freeze({
  opacity: 1,
  backgroundColor: '#00f5d4',
  borderColor: '#7928ca',
  borderWidth: 1,
  borderRadius: 16,
  boxShadowX: 0,
  boxShadowY: 18,
  boxShadowBlur: 48,
  boxShadowSpread: -12,
  boxShadowColor: 'rgba(0, 245, 212, 0.45)',
  boxShadowInset: false,
  transformOriginX: 50,
  transformOriginY: 50,
});

export const DEFAULT_PREVIEW_CONFIG: Readonly<PreviewConfig> = Object.freeze({
  shape: 'cube',
  customSvgContent: '',
  viewportBackground: 'grid-dark',
  showAxes: true,
  showPerspectiveGuide: true,
  enableMotionTrails: false,
  stageLightingIntensity: 0.65,
});

export const DEFAULT_EXPORT_OPTIONS: Readonly<ExportOptions> = Object.freeze({
  target: 'vanilla-css',
  animationClassName: 'studio-animation',
  keyframeRuleName: 'studio-animation',
  includeVendorPrefixes: true,
  includeVariables: true,
  prettify: true,
});

let idSequence = 0;

/**
 * Creates a collision-resistant identifier without depending on browser-only
 * APIs. `crypto.randomUUID` is used when available (browsers and Node 19+),
 * otherwise a monotonic counter plus base36 entropy keeps ids unique per tab.
 */
export function createId(prefix: string): string {
  idSequence += 1;
  const cryptoRef: Crypto | undefined = typeof globalThis === 'undefined' ? undefined : globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return `${prefix}_${cryptoRef.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }
  const entropy = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${idSequence.toString(36)}${entropy}`;
}

/** Clamps `value` into `[min, max]`, mapping non-finite input to `fallback`. */
export function clampNumber(value: number, min: number, max: number, fallback = min): number {
  if (!Number.isFinite(value)) return fallback;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Rounds to a fixed number of decimals without floating point drift. */
export function roundTo(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function createTransformProperties(overrides: Partial<TransformProperties> = {}): TransformProperties {
  return { ...DEFAULT_TRANSFORM_PROPERTIES, ...overrides };
}

export function createFilterProperties(overrides: Partial<FilterProperties> = {}): FilterProperties {
  return { ...DEFAULT_FILTER_PROPERTIES, ...overrides };
}

export function createStyleProperties(overrides: Partial<StyleProperties> = {}): StyleProperties {
  return { ...DEFAULT_STYLE_PROPERTIES, ...overrides };
}

export function createKeyframeProperties(overrides: PartialKeyframeProperties = {}): KeyframeProperties {
  return {
    transform: createTransformProperties(overrides.transform),
    filter: createFilterProperties(overrides.filter),
    styles: createStyleProperties(overrides.styles),
  };
}

export interface PartialKeyframeProperties {
  transform?: Partial<TransformProperties>;
  filter?: Partial<FilterProperties>;
  styles?: Partial<StyleProperties>;
}

export interface CreateKeyframePointInput {
  id?: string;
  offset: number;
  timingFunction?: TimingPreset;
  bezier?: CubicBezierPoints;
  properties?: PartialKeyframeProperties;
}

/** Creates a keyframe with fully populated (never partial) property bags. */
export function createKeyframePoint(input: CreateKeyframePointInput): KeyframePoint {
  return {
    id: input.id ?? createId('kf'),
    offset: clampNumber(input.offset, TIMELINE_LIMITS.offset.min, TIMELINE_LIMITS.offset.max, 0),
    timingFunction: input.timingFunction ?? 'ease-in-out',
    bezier: { ...DEFAULT_CUBIC_BEZIER, ...input.bezier },
    properties: createKeyframeProperties(input.properties ?? {}),
  };
}

export interface CreateTimelineInput {
  id?: string;
  name?: string;
  durationMs?: number;
  delayMs?: number;
  iterationCount?: AnimationIteration;
  direction?: AnimationDirection;
  fillMode?: AnimationFillMode;
  keyframes?: KeyframePoint[];
}

/**
 * Creates a timeline. When no keyframes are supplied the factory emits the
 * canonical two-keyframe `0% → 100%` pair required by `validateProjectRecord`.
 */
export function createTimeline(input: CreateTimelineInput = {}): AnimationTimeline {
  const keyframes =
    input.keyframes && input.keyframes.length > 0
      ? sortKeyframesByOffset(input.keyframes)
      : [createKeyframePoint({ offset: 0 }), createKeyframePoint({ offset: 100 })];

  return {
    id: input.id ?? createId('tl'),
    name: input.name ?? 'Untitled Timeline',
    durationMs: clampNumber(
      input.durationMs ?? TIMELINE_LIMITS.durationMs.defaultValue,
      TIMELINE_LIMITS.durationMs.min,
      TIMELINE_LIMITS.durationMs.max,
      TIMELINE_LIMITS.durationMs.defaultValue,
    ),
    delayMs: clampNumber(
      input.delayMs ?? TIMELINE_LIMITS.delayMs.defaultValue,
      TIMELINE_LIMITS.delayMs.min,
      TIMELINE_LIMITS.delayMs.max,
      TIMELINE_LIMITS.delayMs.defaultValue,
    ),
    iterationCount: input.iterationCount ?? TIMELINE_LIMITS.iterationCount.defaultValue,
    direction: input.direction ?? 'normal',
    fillMode: input.fillMode ?? 'both',
    keyframes,
  };
}

export interface CreateProjectRecordInput {
  id?: string;
  name?: string;
  description?: string;
  activeTimelineId?: string;
  timelines?: AnimationTimeline[];
  preview?: Partial<PreviewConfig>;
  createdAt?: number;
  updatedAt?: number;
}

/** Creates a fully valid `ProjectRecord` from optional partial input. */
export function createProjectRecord(input: CreateProjectRecordInput = {}): ProjectRecord {
  const now = Date.now();
  const timelines = input.timelines && input.timelines.length > 0 ? input.timelines : [createTimeline()];
  const requestedActive = input.activeTimelineId;
  const activeTimelineId =
    requestedActive && timelines.some((timeline) => timeline.id === requestedActive)
      ? requestedActive
      : timelines[0].id;

  return {
    id: input.id ?? createId('prj'),
    name: input.name ?? 'Untitled Sandbox',
    description: input.description ?? 'CSS keyframe sandbox project',
    activeTimelineId,
    timelines,
    preview: { ...DEFAULT_PREVIEW_CONFIG, ...input.preview },
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

// ---------------------------------------------------------------------------
// 5. Validation — offsets, ranges, records, bezier handles
// ---------------------------------------------------------------------------

export function validateKeyframeOffset(
  offset: number,
  existingKeyframes: Pick<KeyframePoint, 'id' | 'offset'>[],
  excludeId?: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (offset < 0 || offset > 100) {
    errors.push({ field: 'offset', message: 'Keyframe offset must be clamped between 0 and 100.' });
  }
  const isDuplicate = existingKeyframes.some((kf) => kf.id !== excludeId && kf.offset === offset);
  if (isDuplicate) {
    errors.push({ field: 'offset', message: 'Keyframe offsets must be unique within a timeline.' });
  }
  return errors;
}

export function validatePropertyRanges(props: KeyframeProperties): ValidationError[] {
  const errors: ValidationError[] = [];
  if (props.styles.opacity < 0 || props.styles.opacity > 1) {
    errors.push({ field: 'styles.opacity', message: 'Style opacity must reside within [0, 1].' });
  }
  if (props.filter.opacity < 0 || props.filter.opacity > 100) {
    errors.push({ field: 'filter.opacity', message: 'Filter opacity must reside within [0, 100].' });
  }
  if (props.filter.brightness < 0) {
    errors.push({ field: 'filter.brightness', message: 'Brightness cannot be negative.' });
  }
  if (props.filter.contrast < 0) {
    errors.push({ field: 'filter.contrast', message: 'Contrast cannot be negative.' });
  }
  if (props.filter.blur < 0) {
    errors.push({ field: 'filter.blur', message: 'Blur radius cannot be negative.' });
  }
  if (props.transform.scaleX < 0 || props.transform.scaleY < 0 || props.transform.scaleZ < 0) {
    errors.push({ field: 'transform.scale', message: 'Scale dimensions must be non-negative.' });
  }

  const bounded: Array<[string, number, NumericRange]> = [
    ['styles.borderWidth', props.styles.borderWidth, STYLE_LIMITS.borderWidth],
    ['styles.borderRadius', props.styles.borderRadius, STYLE_LIMITS.borderRadius],
    ['styles.transformOriginX', props.styles.transformOriginX, STYLE_LIMITS.transformOriginX],
    ['styles.transformOriginY', props.styles.transformOriginY, STYLE_LIMITS.transformOriginY],
    ['filter.brightness', props.filter.brightness, FILTER_LIMITS.brightness],
    ['filter.contrast', props.filter.contrast, FILTER_LIMITS.contrast],
    ['filter.grayscale', props.filter.grayscale, FILTER_LIMITS.grayscale],
    ['filter.hueRotate', props.filter.hueRotate, FILTER_LIMITS.hueRotate],
    ['filter.invert', props.filter.invert, FILTER_LIMITS.invert],
    ['filter.saturate', props.filter.saturate, FILTER_LIMITS.saturate],
    ['transform.translateX', props.transform.translateX, TRANSFORM_LIMITS.translateX],
    ['transform.translateY', props.transform.translateY, TRANSFORM_LIMITS.translateY],
    ['transform.translateZ', props.transform.translateZ, TRANSFORM_LIMITS.translateZ],
    ['transform.rotateX', props.transform.rotateX, TRANSFORM_LIMITS.rotateX],
    ['transform.rotateY', props.transform.rotateY, TRANSFORM_LIMITS.rotateY],
    ['transform.rotateZ', props.transform.rotateZ, TRANSFORM_LIMITS.rotateZ],
    ['transform.skewX', props.transform.skewX, TRANSFORM_LIMITS.skewX],
    ['transform.skewY', props.transform.skewY, TRANSFORM_LIMITS.skewY],
  ];

  for (const [field, value, limits] of bounded) {
    if (!Number.isFinite(value) || value < limits.min || value > limits.max) {
      errors.push({
        field,
        message: `Value must be a finite number within [${limits.min}, ${limits.max}].`,
      });
    }
  }

  return errors;
}

export function validateProjectRecord(project: ProjectRecord): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!project.timelines || project.timelines.length === 0) {
    errors.push({ field: 'timelines', message: 'Project must contain at least one timeline.' });
  }
  const activeExists = project.timelines.some((t) => t.id === project.activeTimelineId);
  if (!activeExists) {
    errors.push({ field: 'activeTimelineId', message: 'Active timeline ID does not match any project timeline.' });
  }
  for (const timeline of project.timelines) {
    if (!timeline.keyframes || timeline.keyframes.length < 2) {
      errors.push({ field: `timeline.${timeline.id}`, message: 'Each timeline must contain at least 2 keyframes.' });
    }
    const hasZero = timeline.keyframes.some((k) => k.offset === 0);
    const hasHundred = timeline.keyframes.some((k) => k.offset === 100);
    if (!hasZero || !hasHundred) {
      errors.push({ field: `timeline.${timeline.id}`, message: 'Timeline requires explicit 0% and 100% keyframe endpoints.' });
    }
  }
  return errors;
}

export function validateBezierCoords(bezier: CubicBezierPoints): ValidationError[] {
  const errors: ValidationError[] = [];
  if (bezier.x1 < 0 || bezier.x1 > 1) {
    errors.push({ field: 'x1', message: 'Handle X1 coordinate must reside within the range [0, 1].' });
  }
  if (bezier.x2 < 0 || bezier.x2 > 1) {
    errors.push({ field: 'x2', message: 'Handle X2 coordinate must reside within the range [0, 1].' });
  }
  return errors;
}

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FUNCTIONAL_COLOR_PATTERN = /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\([^()]*\)$/i;
const NAMED_COLOR_PATTERN = /^[a-zA-Z]{3,32}$/;

export function isValidCssColor(value: string): boolean {
  const candidate = value.trim();
  if (candidate.length === 0) return false;
  return (
    HEX_COLOR_PATTERN.test(candidate) ||
    FUNCTIONAL_COLOR_PATTERN.test(candidate) ||
    NAMED_COLOR_PATTERN.test(candidate) ||
    candidate === 'transparent' ||
    candidate === 'currentColor'
  );
}

export function validateCssColor(field: string, value: string): ValidationError[] {
  return isValidCssColor(value) ? [] : [{ field, message: 'Value must be a valid CSS color expression.' }];
}

const CSS_IDENTIFIER_PATTERN = /^-?[_a-zA-Z][-_a-zA-Z0-9]*$/;

/** True when `value` is usable as a CSS identifier (and, therefore, a class name). */
export function isValidCssIdentifier(value: string): boolean {
  const candidate = value.trim();
  if (candidate.length === 0 || candidate.length > 120) return false;
  if (candidate.startsWith('--')) return false;
  return CSS_IDENTIFIER_PATTERN.test(candidate);
}

export function validateCssIdentifier(field: string, value: string): ValidationError[] {
  return isValidCssIdentifier(value)
    ? []
    : [
        {
          field,
          message: 'Must start with a letter, digit reference or underscore and contain only letters, digits, hyphens or underscores.',
        },
      ];
}

export function validateIterationCount(iteration: AnimationIteration): ValidationError[] {
  if (iteration === 'infinite') return [];
  if (!Number.isFinite(iteration) || !Number.isInteger(iteration) || iteration < 1) {
    return [{ field: 'iterationCount', message: 'Iteration count must be a positive integer or "infinite".' }];
  }
  if (iteration > TIMELINE_LIMITS.iterationCount.max) {
    return [
      {
        field: 'iterationCount',
        message: `Iteration count must not exceed ${TIMELINE_LIMITS.iterationCount.max}.`,
      },
    ];
  }
  return [];
}

/** Validates a single keyframe against the numeric limits and its siblings. */
export function validateKeyframePoint(
  keyframe: KeyframePoint,
  siblings: Pick<KeyframePoint, 'id' | 'offset'>[],
): ValidationError[] {
  const errors: ValidationError[] = [
    ...validateKeyframeOffset(keyframe.offset, siblings, keyframe.id),
    ...validatePropertyRanges(keyframe.properties),
    ...validateBezierCoords(keyframe.bezier),
  ];

  if (!Number.isFinite(keyframe.offset)) {
    errors.push({ field: 'offset', message: 'Keyframe offset must be a finite number.' });
  }
  if (!isTimingPreset(keyframe.timingFunction)) {
    errors.push({ field: 'timingFunction', message: 'Unknown timing function preset.' });
  }
  if (!Number.isFinite(keyframe.bezier.y1) || !Number.isFinite(keyframe.bezier.y2)) {
    errors.push({ field: 'bezier', message: 'Cubic bezier Y coordinates must be finite numbers.' });
  }
  for (const [field, color] of [
    ['styles.backgroundColor', keyframe.properties.styles.backgroundColor],
    ['styles.borderColor', keyframe.properties.styles.borderColor],
    ['styles.boxShadowColor', keyframe.properties.styles.boxShadowColor],
  ] as const) {
    errors.push(...validateCssColor(field, color));
  }
  return errors;
}

/** Validates timeline-level timing invariants (duration, delay, iterations, keyframes). */
export function validateTimelineTiming(timeline: AnimationTimeline): ValidationError[] {
  const errors: ValidationError[] = [];
  const field = `timeline.${timeline.id}`;

  if (!Number.isFinite(timeline.durationMs) || timeline.durationMs < TIMELINE_LIMITS.durationMs.min) {
    errors.push({
      field: `${field}.durationMs`,
      message: `Duration must be at least ${TIMELINE_LIMITS.durationMs.min}ms.`,
    });
  }
  if (timeline.durationMs > TIMELINE_LIMITS.durationMs.max) {
    errors.push({
      field: `${field}.durationMs`,
      message: `Duration must not exceed ${TIMELINE_LIMITS.durationMs.max}ms.`,
    });
  }
  if (!Number.isFinite(timeline.delayMs) || timeline.delayMs < 0) {
    errors.push({ field: `${field}.delayMs`, message: 'Delay must be a non-negative number of milliseconds.' });
  }
  if (!isAnimationDirection(timeline.direction)) {
    errors.push({ field: `${field}.direction`, message: 'Unknown animation direction.' });
  }
  if (!isAnimationFillMode(timeline.fillMode)) {
    errors.push({ field: `${field}.fillMode`, message: 'Unknown animation fill mode.' });
  }
  if (timeline.name.trim().length === 0) {
    errors.push({ field: `${field}.name`, message: 'Timeline name must not be empty.' });
  }
  errors.push(...validateIterationCount(timeline.iterationCount).map((error) => ({ ...error, field: `${field}.iterationCount` })));

  const seenOffsets = new Set<number>();
  for (const keyframe of timeline.keyframes) {
    if (seenOffsets.has(keyframe.offset)) {
      errors.push({
        field: `${field}.keyframes.${keyframe.id}.offset`,
        message: 'Keyframe offsets must be unique within a timeline.',
      });
    }
    seenOffsets.add(keyframe.offset);
    errors.push(
      ...validateKeyframePoint(keyframe, timeline.keyframes).map((error) => ({
        ...error,
        field: `${field}.keyframes.${keyframe.id}.${error.field}`,
      })),
    );
  }

  return errors;
}

export function validatePreviewConfig(preview: PreviewConfig): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!isPreviewElementShape(preview.shape)) {
    errors.push({ field: 'preview.shape', message: 'Unknown preview element shape.' });
  }
  if (!isViewportBackground(preview.viewportBackground)) {
    errors.push({ field: 'preview.viewportBackground', message: 'Unknown viewport background preset.' });
  }
  const intensity = preview.stageLightingIntensity;
  if (!Number.isFinite(intensity) || intensity < PREVIEW_LIMITS.stageLightingIntensity.min || intensity > 1) {
    errors.push({
      field: 'preview.stageLightingIntensity',
      message: 'Stage lighting intensity must reside within [0, 1].',
    });
  }
  return errors;
}

export function validateExportOptions(options: ExportOptions): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!EXPORT_TARGETS.includes(options.target)) {
    errors.push({ field: 'target', message: 'Unknown export target.' });
  }
  errors.push(...validateCssIdentifier('animationClassName', options.animationClassName));
  errors.push(...validateCssIdentifier('keyframeRuleName', options.keyframeRuleName));
  return errors;
}

/**
 * Full project invariant check: structural rules first, then per-timeline
 * timing, then per-keyframe property ranges. Returns an empty array when the
 * record is safe to persist and render.
 */
export function validateProjectInvariants(project: ProjectRecord): ValidationError[] {
  return [
    ...validateProjectRecord(project),
    ...project.timelines.flatMap((timeline) => validateTimelineTiming(timeline)),
    ...validatePreviewConfig(project.preview),
  ];
}

// ---------------------------------------------------------------------------
// 6. Project CRUD invariants (pure, immutable)
// ---------------------------------------------------------------------------

export class ProjectInvariantError extends Error {
  readonly errors: ValidationError[];

  constructor(context: string, errors: ValidationError[]) {
    super(`${context} rejected: ${errors.map((error) => `${error.field} — ${error.message}`).join('; ')}`);
    this.name = 'ProjectInvariantError';
    this.errors = errors;
  }
}

export interface MutationSuccess<T> {
  ok: true;
  value: T;
  errors: [];
}

export interface MutationFailure {
  ok: false;
  value: null;
  errors: ValidationError[];
}

export type MutationResult<T> = MutationSuccess<T> | MutationFailure;

export function mutationSuccess<T>(value: T): MutationSuccess<T> {
  return { ok: true, value, errors: [] };
}

export function mutationFailure<T>(errors: ValidationError[]): MutationFailure {
  return { ok: false, value: null, errors: errors.length > 0 ? errors : [{ field: 'unknown', message: 'Mutation rejected.' }] };
}

/** Throws `ProjectInvariantError` when `errors` is non-empty. */
export function assertNoErrors(errors: ValidationError[], context: string): void {
  if (errors.length > 0) {
    throw new ProjectInvariantError(context, errors);
  }
}

/** Sorts keyframes by offset without mutating the input array. */
export function sortKeyframesByOffset(keyframes: readonly KeyframePoint[]): KeyframePoint[] {
  return [...keyframes].sort((a, b) => a.offset - b.offset);
}

export function findTimeline(project: ProjectRecord, timelineId: string): AnimationTimeline | undefined {
  return project.timelines.find((timeline) => timeline.id === timelineId);
}

export function findKeyframe(timeline: AnimationTimeline, keyframeId: string): KeyframePoint | undefined {
  return timeline.keyframes.find((keyframe) => keyframe.id === keyframeId);
}

export function getActiveTimeline(project: ProjectRecord): AnimationTimeline | undefined {
  return findTimeline(project, project.activeTimelineId);
}

export function isTimelineEndpoint(timeline: AnimationTimeline, keyframe: KeyframePoint): boolean {
  return keyframe.offset === 0 || keyframe.offset === 100;
}

export function cloneProjectRecord(project: ProjectRecord): ProjectRecord {
  return {
    ...project,
    timelines: project.timelines.map((timeline) => ({
      ...timeline,
      keyframes: timeline.keyframes.map((keyframe) => ({
        ...keyframe,
        bezier: { ...keyframe.bezier },
        properties: {
          transform: { ...keyframe.properties.transform },
          filter: { ...keyframe.properties.filter },
          styles: { ...keyframe.properties.styles },
        },
      })),
    })),
    preview: { ...project.preview },
  };
}

/** Stamps `updatedAt` without mutating the source record. */
export function touchProject(project: ProjectRecord, timestamp = Date.now()): ProjectRecord {
  return { ...project, updatedAt: timestamp };
}

function replaceTimeline(project: ProjectRecord, timelineId: string, next: AnimationTimeline): ProjectRecord {
  return {
    ...project,
    timelines: project.timelines.map((timeline) => (timeline.id === timelineId ? next : timeline)),
    updatedAt: Date.now(),
  };
}

export function setActiveTimeline(project: ProjectRecord, timelineId: string): MutationResult<ProjectRecord> {
  const timeline = findTimeline(project, timelineId);
  if (!timeline) {
    return mutationFailure([{ field: 'activeTimelineId', message: 'Cannot activate a timeline that does not exist.' }]);
  }
  return mutationSuccess({ ...project, activeTimelineId: timelineId, updatedAt: Date.now() });
}

/**
 * Adds a timeline. A project always keeps at least one timeline, so the first
 * timeline added to an empty record is rejected (use `createProjectRecord`).
 */
export function addTimeline(project: ProjectRecord, timeline: AnimationTimeline): MutationResult<ProjectRecord> {
  if (findTimeline(project, timeline.id)) {
    return mutationFailure([{ field: `timeline.${timeline.id}`, message: 'A timeline with this id already exists.' }]);
  }
  const errors = validateTimelineTiming(timeline);
  if (errors.length > 0) return mutationFailure(errors);

  return mutationSuccess(
    touchProject({
      ...project,
      timelines: [...project.timelines, { ...timeline, keyframes: sortKeyframesByOffset(timeline.keyframes) }],
    }),
  );
}

/** Replaces a timeline wholesale; rejects any change that breaks its invariants. */
export function updateTimeline(
  project: ProjectRecord,
  timelineId: string,
  updater: (timeline: AnimationTimeline) => AnimationTimeline,
): MutationResult<ProjectRecord> {
  const current = findTimeline(project, timelineId);
  if (!current) {
    return mutationFailure([{ field: `timeline.${timelineId}`, message: 'Timeline does not exist.' }]);
  }
  const next = updater(current);
  const errors = validateTimelineTiming(next).map((error) => ({ ...error, field: error.field.replace(`timeline.${next.id}`, `timeline.${timelineId}`) }));
  if (errors.length > 0) return mutationFailure(errors);

  return mutationSuccess(replaceTimeline(project, timelineId, { ...next, keyframes: sortKeyframesByOffset(next.keyframes) }));
}

/**
 * Removes a timeline. The last remaining timeline cannot be removed, and the
 * active pointer is re-homed to the first survivor when necessary.
 */
export function removeTimeline(project: ProjectRecord, timelineId: string): MutationResult<ProjectRecord> {
  if (!findTimeline(project, timelineId)) {
    return mutationFailure([{ field: `timeline.${timelineId}`, message: 'Timeline does not exist.' }]);
  }
  if (project.timelines.length <= 1) {
    return mutationFailure([
      { field: `timeline.${timelineId}`, message: 'A project must always retain at least one timeline.' },
    ]);
  }

  const timelines = project.timelines.filter((timeline) => timeline.id !== timelineId);
  const activeTimelineId =
    project.activeTimelineId === timelineId ? timelines[0].id : project.activeTimelineId;

  return mutationSuccess(touchProject({ ...project, timelines, activeTimelineId }));
}

/** Inserts a keyframe, rejecting duplicate offsets and out-of-range values. */
export function insertKeyframe(
  project: ProjectRecord,
  timelineId: string,
  keyframe: KeyframePoint,
): MutationResult<ProjectRecord> {
  const timeline = findTimeline(project, timelineId);
  if (!timeline) {
    return mutationFailure([{ field: `timeline.${timelineId}`, message: 'Timeline does not exist.' }]);
  }
  if (findKeyframe(timeline, keyframe.id)) {
    return mutationFailure([{ field: `keyframe.${keyframe.id}`, message: 'A keyframe with this id already exists.' }]);
  }

  const errors = [
    ...validateKeyframeOffset(keyframe.offset, timeline.keyframes),
    ...validatePropertyRanges(keyframe.properties),
  ];
  if (errors.length > 0) return mutationFailure(errors);

  const next: AnimationTimeline = {
    ...timeline,
    keyframes: sortKeyframesByOffset([...timeline.keyframes, keyframe]),
  };
  return mutationSuccess(replaceTimeline(project, timelineId, next));
}

/** Applies a pure updater to one keyframe and re-validates the timeline. */
export function updateKeyframe(
  project: ProjectRecord,
  timelineId: string,
  keyframeId: string,
  updater: (keyframe: KeyframePoint) => KeyframePoint,
): MutationResult<ProjectRecord> {
  const timeline = findTimeline(project, timelineId);
  if (!timeline) {
    return mutationFailure([{ field: `timeline.${timelineId}`, message: 'Timeline does not exist.' }]);
  }
  if (!findKeyframe(timeline, keyframeId)) {
    return mutationFailure([{ field: `keyframe.${keyframeId}`, message: 'Keyframe does not exist in this timeline.' }]);
  }

  const next: AnimationTimeline = {
    ...timeline,
    keyframes: sortKeyframesByOffset(
      timeline.keyframes.map((keyframe) => (keyframe.id === keyframeId ? updater(keyframe) : keyframe)),
    ),
  };
  const errors = validateTimelineTiming(next);
  if (errors.length > 0) return mutationFailure(errors);

  return mutationSuccess(replaceTimeline(project, timelineId, next));
}

/** Removes a keyframe while protecting the 0%/100% endpoints and the last pair. */
export function removeKeyframe(
  project: ProjectRecord,
  timelineId: string,
  keyframeId: string,
): MutationResult<ProjectRecord> {
  const timeline = findTimeline(project, timelineId);
  if (!timeline) {
    return mutationFailure([{ field: `timeline.${timelineId}`, message: 'Timeline does not exist.' }]);
  }
  const target = findKeyframe(timeline, keyframeId);
  if (!target) {
    return mutationFailure([{ field: `keyframe.${keyframeId}`, message: 'Keyframe does not exist in this timeline.' }]);
  }
  if (isTimelineEndpoint(timeline, target)) {
    return mutationFailure([
      { field: `keyframe.${keyframeId}`, message: 'The 0% and 100% keyframe endpoints cannot be removed.' },
    ]);
  }
  if (timeline.keyframes.length <= 2) {
    return mutationFailure([
      { field: `keyframe.${keyframeId}`, message: 'A timeline must always retain at least 2 keyframes.' },
    ]);
  }

  const next: AnimationTimeline = {
    ...timeline,
    keyframes: timeline.keyframes.filter((keyframe) => keyframe.id !== keyframeId),
  };
  return mutationSuccess(replaceTimeline(project, timelineId, next));
}

export type MoveKeyframeResult = MutationResult<ProjectRecord> & {
  /** Offset actually applied after clamping and collision resolution. */
  resolvedOffset: number;
  /** True when the requested offset was occupied and a neighbour offset was chosen. */
  relocated: boolean;
};

/**
 * Moves a keyframe to a new offset. Endpoint keyframes stay pinned to 0% and
 * 100%; a colliding target is nudged to the nearest free offset so drag
 * gestures can never produce an invalid timeline.
 */
export function moveKeyframeOffset(
  project: ProjectRecord,
  timelineId: string,
  keyframeId: string,
  requestedOffset: number,
): MoveKeyframeResult {
  const timeline = findTimeline(project, timelineId);
  if (!timeline) {
    return { ...mutationFailure([{ field: `timeline.${timelineId}`, message: 'Timeline does not exist.' }]), resolvedOffset: 0, relocated: false };
  }
  const target = findKeyframe(timeline, keyframeId);
  if (!target) {
    return { ...mutationFailure([{ field: `keyframe.${keyframeId}`, message: 'Keyframe does not exist in this timeline.' }]), resolvedOffset: 0, relocated: false };
  }
  if (!Number.isFinite(requestedOffset)) {
    return { ...mutationFailure([{ field: 'offset', message: 'Keyframe offset must be a finite number.' }]), resolvedOffset: target.offset, relocated: false };
  }
  if (isTimelineEndpoint(timeline, target)) {
    return {
      ...mutationSuccess(project),
      resolvedOffset: target.offset,
      relocated: false,
    };
  }

  const maxOffset = TIMELINE_LIMITS.offset.max;
  const minOffset = TIMELINE_LIMITS.offset.min;
  const occupied = new Set(
    timeline.keyframes.filter((keyframe) => keyframe.id !== keyframeId).map((keyframe) => keyframe.offset),
  );

  const clamped = roundTo(clampNumber(requestedOffset, minOffset, maxOffset, target.offset), 2);
  if (!occupied.has(clamped)) {
    return {
      ...updateKeyframe(project, timelineId, keyframeId, (keyframe) => ({ ...keyframe, offset: clamped })),
      resolvedOffset: clamped,
      relocated: false,
    };
  }

  // Collision: walk outwards from the requested offset until a free slot is found.
  const epsilon = 0.01;
  for (let step = epsilon; step <= maxOffset - minOffset; step += epsilon) {
    const candidates = [clamped + step, clamped - step];
    for (const candidate of candidates) {
      if (candidate < minOffset || candidate > maxOffset) continue;
      if (occupied.has(candidate)) continue;
      return {
        ...updateKeyframe(project, timelineId, keyframeId, (keyframe) => ({ ...keyframe, offset: candidate })),
        resolvedOffset: candidate,
        relocated: true,
      };
    }
  }

  return {
    ...mutationFailure([{ field: 'offset', message: 'No free keyframe offset is available near the requested position.' }]),
    resolvedOffset: target.offset,
    relocated: false,
  };
}

/** Applies a partial property patch to a single keyframe. */
export function patchKeyframeProperties(
  project: ProjectRecord,
  timelineId: string,
  keyframeId: string,
  patch: PartialKeyframeProperties,
): MutationResult<ProjectRecord> {
  return updateKeyframe(project, timelineId, keyframeId, (keyframe) => ({
    ...keyframe,
    properties: {
      transform: { ...keyframe.properties.transform, ...patch.transform },
      filter: { ...keyframe.properties.filter, ...patch.filter },
      styles: { ...keyframe.properties.styles, ...patch.styles },
    },
  }));
}
