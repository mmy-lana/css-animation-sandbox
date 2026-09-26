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

export interface CubicBezierPoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TransformProperties {
  translateX: number;
  translateY: number;
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
  viewportBackground: 'grid-dark' | 'dots' | 'solid-obsidian' | 'checkerboard';
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

export type ExportTarget = 
  | 'vanilla-css'
  | 'tailwind-v4'
  | 'web-animations-api';

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

export function validateKeyframeOffset(
  offset: number,
  existingKeyframes: Pick<KeyframePoint, 'id' | 'offset'>[],
  excludeId?: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (offset < 0 || offset > 100) {
    errors.push({ field: 'offset', message: 'Keyframe offset must be clamped between 0 and 100.' });
  }
  const isDuplicate = existingKeyframes.some(
    (kf) => kf.id !== excludeId && kf.offset === offset
  );
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
