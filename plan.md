# Specification: CSS Animation Sandbox (`plan.md`)

## 1. Data Schema & Pure TypeScript Interfaces

### 1.1 Core Entities

```typescript
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
  // translateZ in CSS 3D transforms strictly represents physical depth in pixels; unit is fixed to px
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
```

### 1.2 Validation Schemas & Pure Assertions

```typescript
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
```

---

## 2. Component Architecture

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Slider.tsx
│   │   ├── NumberInput.tsx
│   │   ├── Select.tsx
│   │   ├── Switch.tsx
│   │   ├── ColorInput.tsx
│   │   ├── Tooltip.tsx
│   │   └── Modal.tsx
│   ├── timeline/
│   │   ├── TimelineHeader.tsx
│   │   ├── ScrubBar.tsx
│   │   ├── KeyframeNode.tsx
│   │   ├── TrackRuler.tsx
│   │   └── Playhead.tsx
│   ├── stage/
│   │   ├── ViewportStage.tsx
│   │   ├── TransformGizmo.tsx
│   │   ├── Visualizers3D.tsx
│   │   └── TargetGeometry.tsx
│   ├── inspector/
│   │   ├── PropertySection.tsx
│   │   ├── TransformControls.tsx
│   │   ├── FilterControls.tsx
│   │   ├── StyleControls.tsx
│   │   └── BezierCurveEditor.tsx
│   ├── exporter/
│   │   ├── ExportDrawer.tsx
│   │   ├── CodeViewer.tsx
│   │   └── OutputConfigBar.tsx
│   └── navigation/
│       ├── StudioTopNav.tsx
│       └── PresetDrawer.tsx
├── hooks/
│   ├── useAnimationEngine.ts
│   ├── useTimelineScrubber.ts
│   ├── useLocalStorageSync.ts
│   └── useHistoryState.ts
└── lib/
    ├── bezier.ts
    ├── cssGenerator.ts
    ├── tailwindFormatter.ts
    └── storage.ts
```

### Architecture Boundaries & Import Direction

Architecture enforces strict unidirectional dependencies:
`src/types` -> `src/lib` -> `src/hooks` -> `src/components` -> `src/app`
Never import upward (e.g., `src/lib` must never import from `src/components` or `src/hooks`).

#### Client vs Server Boundary Policy
* **Server-Safe Pure Modules**: `src/types/*`, `src/lib/bezier.ts`, `src/lib/cssGenerator.ts`, `src/lib/tailwindFormatter.ts`, `src/lib/sanitizer.ts`.
* **Client-Only Modules (`"use client"`)**: `src/hooks/*`, `src/components/stage/*`, `src/components/timeline/*`, `src/components/inspector/*`, `src/components/exporter/*`, `src/app/page.tsx`. Single-tab LocalStorage persistence pattern is enforced; multi-tab write sync uses native storage event reload notifications.

### Component Hierarchy & Data Flow

```
[ StudioTopNav ]
       │
[ Project Workspace Layout ]
       ├── Left Column: [ Inspector Panel ] (Property inputs, Curve Editor)
       │       │
       │       ▼ (Dispatches property mutations for active keyframe)
       ├── Center: [ ViewportStage ] <---> [ useAnimationEngine ] (Live Preview)
       │       │
       │       ▼ (Pointer drag emits translation/rotation to active frame)
       └── Bottom: [ Timeline Shell ]
               ├── [ ScrubBar ] (Current time position)
               ├── [ TrackRuler ] (Render tick marks at 0..100%)
               └── [ KeyframeNode(s) ] (Drag to slide offset, select frame)
```

---

## 3. Core Feature Logic

### 3.1 CSS Keyframe String Generation Engine

```typescript
export function composeTransformCSS(t: TransformProperties): string {
  const parts: string[] = [];
  if (t.translateX !== 0 || t.translateY !== 0 || t.translateZ !== 0) {
    // translateZ strictly requires px lengths in CSS 3D transforms
    parts.push(`translate3d(${t.translateX}${t.translateUnit}, ${t.translateY}${t.translateUnit}, ${t.translateZ}px)`);
  }
  if (t.rotateX !== 0) parts.push(`rotateX(${t.rotateX}deg)`);
  if (t.rotateY !== 0) parts.push(`rotateY(${t.rotateY}deg)`);
  if (t.rotateZ !== 0) parts.push(`rotateZ(${t.rotateZ}deg)`);
  if (t.scaleX !== 1 || t.scaleY !== 1 || t.scaleZ !== 1) {
    parts.push(`scale3d(${t.scaleX}, ${t.scaleY}, ${t.scaleZ})`);
  }
  if (t.skewX !== 0 || t.skewY !== 0) {
    parts.push(`skew(${t.skewX}deg, ${t.skewY}deg)`);
  }
  return parts.length > 0 ? parts.join(' ') : 'none';
}

export function composeFilterCSS(f: FilterProperties): string {
  const parts: string[] = [];
  if (f.blur > 0) parts.push(`blur(${f.blur}px)`);
  if (f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
  if (f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
  if (f.grayscale > 0) parts.push(`grayscale(${f.grayscale}%)`);
  if (f.hueRotate !== 0) parts.push(`hue-rotate(${f.hueRotate}deg)`);
  if (f.invert > 0) parts.push(`invert(${f.invert}%)`);
  if (f.opacity !== 100) parts.push(`opacity(${f.opacity}%)`);
  if (f.saturate !== 100) parts.push(`saturate(${f.saturate}%)`);
  return parts.length > 0 ? parts.join(' ') : 'none';
}

export function formatTiming(timing: TimingPreset, bezier: CubicBezierPoints): string {
  if (timing === 'custom-cubic') {
    return `cubic-bezier(${bezier.x1.toFixed(2)}, ${bezier.y1.toFixed(2)}, ${bezier.x2.toFixed(2)}, ${bezier.y2.toFixed(2)})`;
  }
  return timing;
}

export function generateVanillaCSSKeyframes(timeline: AnimationTimeline, ruleName: string): string {
  const sorted = [...timeline.keyframes].sort((a, b) => a.offset - b.offset);
  const keyframeBlocks = sorted.map((kf) => {
    const transform = composeTransformCSS(kf.properties.transform);
    const filter = composeFilterCSS(kf.properties.filter);
    const s = kf.properties.styles;
    const shadow = `${s.boxShadowInset ? 'inset ' : ''}${s.boxShadowX}px ${s.boxShadowY}px ${s.boxShadowBlur}px ${s.boxShadowSpread}px ${s.boxShadowColor}`;
    // Keyframe timing function controls the segment toward the NEXT keyframe; terminal 100% keyframe omits timing function
    const isTerminalKeyframe = kf.offset === 100;
    const easingDeclaration = !isTerminalKeyframe
      ? `\n    animation-timing-function: ${formatTiming(kf.timingFunction, kf.bezier)};`
      : '';

    return `  ${kf.offset}% {
    transform: ${transform};
    filter: ${filter};
    opacity: ${s.opacity};
    background-color: ${s.backgroundColor};
    border-color: ${s.borderColor};
    border-width: ${s.borderWidth}px;
    border-radius: ${s.borderRadius}px;
    box-shadow: ${shadow};
    transform-origin: ${s.transformOriginX}% ${s.transformOriginY}%;${easingDeclaration}
  }`;
  }).join('\n');

  return `@keyframes ${ruleName} {\n${keyframeBlocks}\n}`;
}

export function generateAnimationShorthand(timeline: AnimationTimeline, ruleName: string): string {
  const duration = `${(timeline.durationMs / 1000).toFixed(2)}s`;
  const delay = timeline.delayMs > 0 ? `${(timeline.delayMs / 1000).toFixed(2)}s` : '0s';
  const iter = timeline.iterationCount === 'infinite' ? 'infinite' : timeline.iterationCount.toString();
  return `${ruleName} ${duration} linear ${delay} ${iter} ${timeline.direction} ${timeline.fillMode};`;
}
```

### 3.2 Tailwind Config Serializer

```typescript
/**
 * Tailwind v4 Exporter
 * Generates an immediately usable `animate-${animationName}` utility via CSS-first @theme token
 * and matching @keyframes block.
 */
export function generateTailwindV4CSS(timeline: AnimationTimeline, animationName: string): string {
  const keyframesBlock = generateVanillaCSSKeyframes(timeline, animationName);
  const duration = `${(timeline.durationMs / 1000).toFixed(2)}s`;
  const delay = timeline.delayMs > 0 ? ` ${(timeline.delayMs / 1000).toFixed(2)}s` : '';
  const iter = timeline.iterationCount === 'infinite' ? 'infinite' : timeline.iterationCount.toString();
  const shorthand = `${duration} linear${delay} ${iter} ${timeline.direction} ${timeline.fillMode}`;

  return `/* Tailwind CSS v4 Theme Extension
 * Usage: <div class="animate-${animationName}">...</div>
 */
@theme {
  --animate-${animationName}: ${animationName} ${shorthand};
}

${keyframesBlock}`;
}
```

### 3.3 Interactive Scrubber Algorithm

```typescript
export function computeScrubPercentage(
  clientX: number,
  trackBoundingRect: DOMRect
): number {
  if (trackBoundingRect.width === 0) return 0;
  const relativeX = clientX - trackBoundingRect.left;
  const rawPercentage = (relativeX / trackBoundingRect.width) * 100;
  return Math.min(Math.max(rawPercentage, 0), 100);
}
```

### 3.4 Web Animations API Synchronizer

```typescript
export function toWaapiIterations(iteration: AnimationIteration): number {
  return iteration === 'infinite' ? Infinity : iteration;
}

export function createCanonicalWaapiAnimation(
  node: HTMLElement,
  timeline: AnimationTimeline,
  mode: 'scrub' | 'playback'
): Animation | null {
  const sorted = [...timeline.keyframes].sort((a, b) => a.offset - b.offset);
  if (sorted.length < 2) return null;

  const keyframes = sorted.map((kf, index) => {
    const isTerminal = index === sorted.length - 1;
    return {
      offset: kf.offset / 100,
      transform: composeTransformCSS(kf.properties.transform),
      filter: composeFilterCSS(kf.properties.filter),
      opacity: kf.properties.styles.opacity,
      backgroundColor: kf.properties.styles.backgroundColor,
      borderRadius: `${kf.properties.styles.borderRadius}px`,
      ...(isTerminal ? {} : { easing: formatTiming(kf.timingFunction, kf.bezier) }),
    };
  });

  const options: KeyframeAnimationOptions = mode === 'playback'
    ? {
        duration: timeline.durationMs,
        delay: timeline.delayMs,
        iterations: toWaapiIterations(timeline.iterationCount),
        direction: timeline.direction,
        fill: timeline.fillMode,
      }
    : {
        duration: timeline.durationMs,
        fill: 'both',
      };

  return node.animate(keyframes, options);
}

export function applyScrubToDOMNode(
  node: HTMLElement,
  timeline: AnimationTimeline,
  progressRatio: number
): void {
  const anim = createCanonicalWaapiAnimation(node, timeline, 'scrub');
  if (!anim) return;
  anim.pause();
  anim.currentTime = Math.min(timeline.durationMs, Math.max(0, timeline.durationMs * progressRatio));
}
```

---

## 4. Mobile-First Responsive Breakpoints & Ergonomics

| Viewport Width | Layout Disposition | Timeline Track Behavior | Gizmo Display | Primary Action Bar |
| :--- | :--- | :--- | :--- | :--- |
| **360px - 430px** (Mobile) | Single-column stacked; Viewport fixed top (`min-h-[38dvh]`); bottom navigation shell padding `calc(64px + env(safe-area-inset-bottom))`; Tabs for Timeline / Inspector / Code below. | Gesture arbitration: Tap selects node; pointer drag on node translates keyframe offset; drag on empty timeline track scrolls horizontally (`touch-action: pan-x`). Collision ordering: active selected node renders at highest z-index. | Simplified 2D axis pad; 3D perspective preview disabled. | Floating bottom dock with Play/Pause, Add Keyframe, and Export Trigger. |
| **768px** (Tablet) | Split Viewport (`50dvh`) & Timeline; Collapsible bottom-sheet Inspector. | Full-width timeline; dual-touch zoom gestures for millisecond zooming. | Standard 2D translate handles enabled. | Secondary header navigation with quick presets dropdown. |
| **1024px+** (Desktop) | 3-Column Studio Grid: Left Property Inspector (320px), Center Stage & Bottom Timeline, Right Live CSS/Code Panel (380px). | Full-width timeline ruler with interactive multi-node drag and cubic-bezier graph overlay. Keyboard: Arrow keys step frame offsets by 1% (Shift+Arrow by 5%). | Full 3D gimbal gizmo with direct vector manipulation. | Persistent Studio TopNav with instantaneous export and timeline switcher. |

### Accessibility & Security Invariants
* **Keyboard Navigation**: All interactive elements (keyframe nodes, bezier handles, scrubber) must support focus ring indicators (`focus-visible:ring-1 focus-visible:ring-cyan-400`), arrow key adjustments, and `aria-label` / `aria-valuemin` / `aria-valuemax` attributes.
* **SVG Sanitization Boundary**: `customSvgContent` must pass strictly through `dompurify` configured with `USE_PROFILES: { svg: true, svgFilters: true }` before DOM injection. Regex-based tag stripping is prohibited.
* **Scope Boundary**: Animatable properties in v1 are strictly bounded to the attributes declared in `KeyframeProperties`.

---

## 5. Sequential Implementation Queue

### Phase 1: Types, Storage/API Client Config, and Base Utilities
- [ ] Create `src/types/sandbox.ts` containing all core types, schema range validations, and project CRUD invariants.
- [ ] Create `src/lib/sanitizer.ts` wrapping `dompurify` strictly with SVG profile options for safe preview rendering.
- [ ] Build `src/lib/storage.ts` using single-tab typed `localStorage` fallback with multi-tab storage event listeners and JSON schema migration.
- [ ] Create `src/lib/bezier.ts` with explicit cubic-bezier coordinate interpolation functions and validation algorithms.
- [ ] Create `src/lib/cssGenerator.ts` and `src/lib/tailwindFormatter.ts` outputting standard CSS `@keyframes` and Tailwind v4 `@theme` CSS blocks.

### Phase 2: Design Foundation & Atomic UI Primitives
- [ ] Implement High-End Creative Studio design tokens in `src/app/globals.css` (Deep obsidian backgrounds `#09090b`, `#121217`, metallic borders `#27272a`, accent cyan `#00f5d4` and violet `#7928ca`).
- [ ] Build atomic components:
  - `src/components/ui/Button.tsx`: High-contrast, micro-interaction states, strict SVG icon usage.
  - `src/components/ui/Slider.tsx`: Precision drag track, formatted value bubble, touch-first thumb.
  - `src/components/ui/NumberInput.tsx`: Draggable scrub label + typed numerical boundary validation.
  - `src/components/ui/Select.tsx`: Accessible headless popup with dark-mode styling.
  - `src/components/ui/ColorInput.tsx`: Hex / RGB / Alpha picker with preset studio swatches.
  - `src/components/ui/Modal.tsx`: Accessible portal dialog with backdrop blur.

### Phase 3: Compound Molecules & Feature Components
- [ ] Build `src/components/timeline/TrackRuler.tsx` with tick marks (10% increments), time labels, and interactive click-to-seek.
- [ ] Build `src/components/timeline/KeyframeNode.tsx` with 44px pointer-events target, active/selected states, and pointer-capture drag support.
- [ ] Build `src/components/stage/TargetGeometry.tsx` rendering polymorphic element states (box, sphere, card, custom SVG) under dynamic styles.
- [ ] Build `src/components/inspector/BezierCurveEditor.tsx` using an interactive SVG canvas displaying control handle handles P1 and P2 with interactive drag points.
- [ ] Build `src/components/inspector/TransformControls.tsx`, `FilterControls.tsx`, and `StyleControls.tsx`.

### Phase 4: Domain Logic, Reactive State, and Specialized APIs
- [ ] Build `src/hooks/useHistoryState.ts` providing immutable undo/redo states for timeline keyframe adjustments.
- [ ] Build `src/hooks/useTimelineScrubber.ts` supporting RAF-synced pointer scrubbing and fractional offset conversion.
- [ ] Build `src/hooks/useAnimationEngine.ts` governing play/pause status, loop iterations, duration scaling, and direct node animation frame syncing.
- [ ] Build `src/components/stage/TransformGizmo.tsx` rendering on-screen rotational and translation drag rings over the preview target.

### Phase 5: Complete Page/Screen Assembly & Responsive Shell
- [ ] Assemble `src/components/timeline/ScrubBar.tsx` integrating Play/Pause, Frame Stepping, Time Counters, and Keyframe Markers.
- [ ] Assemble `src/components/stage/ViewportStage.tsx` with stage background switcher, perspective slider, and viewport zoom/reset.
- [ ] Assemble `src/components/exporter/ExportDrawer.tsx` with `CodeViewer.tsx` featuring tabbed code views (CSS, Tailwind v4 `@theme`, WAAPI) with one-click clipboard copy.
- [ ] Assemble `src/app/page.tsx` integrating responsive mobile drawer switches, desktop 3-pane layout, and storage hydration on mount. Validate against 360px, 390px, 430px, 768px, and 1024px+ viewports.