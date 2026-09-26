/**
 * CSS / Web Animations API generation engine.
 *
 * Every function in this module is pure: it maps an `AnimationTimeline` (or a
 * pointer position) to text or to a paused `Animation` handle. Nothing here
 * touches React state, and DOM access is confined to the two functions that
 * explicitly receive an `HTMLElement` from the caller, so the module remains
 * importable from server components.
 */

import {
  isTimingPreset,
  type AnimationIteration,
  type AnimationTimeline,
  type CubicBezierPoints,
  type ExportOptions,
  type FilterProperties,
  type KeyframePoint,
  type StyleProperties,
  type TimingPreset,
  type TransformProperties,
} from '@/types/sandbox';

// ---------------------------------------------------------------------------
// Scalar formatting helpers
// ---------------------------------------------------------------------------

/** Formats a CSS number, trimming redundant trailing zeros. */
export function formatCssNumber(value: number, precision = 3): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Number(value.toFixed(precision));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

/** Formats milliseconds as a CSS `<time>` value, e.g. `1500ms` → `1.50s`. */
export function formatMillisecondsAsSeconds(milliseconds: number, precision = 2): string {
  const safe = Number.isFinite(milliseconds) ? milliseconds : 0;
  return `${(safe / 1000).toFixed(precision)}s`;
}

/** Converts a CSS identifier candidate into a safe, kebab-case token. */
export function toKebabCase(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/**
 * Coerces arbitrary user input into a valid CSS identifier so generated
 * stylesheets can never emit a malformed rule. Always returns a usable token.
 */
export function normalizeCssIdentifier(value: string, fallback: string): string {
  const kebab = toKebabCase(value);
  if (kebab.length === 0) return toKebabCase(fallback) || 'animation';
  const prefixed = /^[0-9-]/.test(kebab) ? `x-${kebab}` : kebab;
  return prefixed.slice(0, 120);
}

// ---------------------------------------------------------------------------
// Property composers
// ---------------------------------------------------------------------------

/**
 * Composes a CSS `transform` list.
 *
 * `translateZ` is always emitted in `px`: a 3D translation depth is a physical
 * length, and `%`/`rem` are not valid for it in a 3D transform context.
 */
export function composeTransformCSS(t: TransformProperties): string {
  const parts: string[] = [];
  if (t.translateX !== 0 || t.translateY !== 0 || t.translateZ !== 0) {
    parts.push(
      `translate3d(${formatCssNumber(t.translateX)}${t.translateUnit}, ${formatCssNumber(t.translateY)}${t.translateUnit}, ${formatCssNumber(t.translateZ)}px)`,
    );
  }
  if (t.rotateX !== 0) parts.push(`rotateX(${formatCssNumber(t.rotateX)}deg)`);
  if (t.rotateY !== 0) parts.push(`rotateY(${formatCssNumber(t.rotateY)}deg)`);
  if (t.rotateZ !== 0) parts.push(`rotateZ(${formatCssNumber(t.rotateZ)}deg)`);
  if (t.scaleX !== 1 || t.scaleY !== 1 || t.scaleZ !== 1) {
    parts.push(`scale3d(${formatCssNumber(t.scaleX)}, ${formatCssNumber(t.scaleY)}, ${formatCssNumber(t.scaleZ)})`);
  }
  if (t.skewX !== 0 || t.skewY !== 0) {
    parts.push(`skew(${formatCssNumber(t.skewX)}deg, ${formatCssNumber(t.skewY)}deg)`);
  }
  return parts.length > 0 ? parts.join(' ') : 'none';
}

/** Composes a CSS `filter` list, omitting every function left at its identity value. */
export function composeFilterCSS(f: FilterProperties): string {
  const parts: string[] = [];
  if (f.blur > 0) parts.push(`blur(${formatCssNumber(f.blur)}px)`);
  if (f.brightness !== 100) parts.push(`brightness(${formatCssNumber(f.brightness)}%)`);
  if (f.contrast !== 100) parts.push(`contrast(${formatCssNumber(f.contrast)}%)`);
  if (f.grayscale > 0) parts.push(`grayscale(${formatCssNumber(f.grayscale)}%)`);
  if (f.hueRotate !== 0) parts.push(`hue-rotate(${formatCssNumber(f.hueRotate)}deg)`);
  if (f.invert > 0) parts.push(`invert(${formatCssNumber(f.invert)}%)`);
  if (f.opacity !== 100) parts.push(`opacity(${formatCssNumber(f.opacity)}%)`);
  if (f.saturate !== 100) parts.push(`saturate(${formatCssNumber(f.saturate)}%)`);
  return parts.length > 0 ? parts.join(' ') : 'none';
}

/** Composes a CSS `box-shadow` value including the optional `inset` keyword. */
export function composeBoxShadowCSS(s: StyleProperties): string {
  const shadow = `${s.boxShadowInset ? 'inset ' : ''}${formatCssNumber(s.boxShadowX)}px ${formatCssNumber(s.boxShadowY)}px ${formatCssNumber(s.boxShadowBlur)}px ${formatCssNumber(s.boxShadowSpread)}px ${s.boxShadowColor}`;
  return shadow.trim();
}

/** Renders the timing function that governs the segment *toward the next keyframe*. */
export function formatTiming(timing: TimingPreset, bezier: CubicBezierPoints): string {
  if (timing === 'custom-cubic') {
    return `cubic-bezier(${bezier.x1.toFixed(2)}, ${bezier.y1.toFixed(2)}, ${bezier.x2.toFixed(2)}, ${bezier.y2.toFixed(2)})`;
  }
  return isTimingPreset(timing) ? timing : 'ease';
}

/** Renders the iteration count token used by the `animation` shorthand. */
export function formatIterationCount(iteration: AnimationIteration): string {
  return iteration === 'infinite' ? 'infinite' : String(Math.max(1, Math.round(iteration)));
}

// ---------------------------------------------------------------------------
// Vanilla CSS generation
// ---------------------------------------------------------------------------

/** Returns the timeline keyframes ordered by offset without mutating the source. */
export function getSortedKeyframes(timeline: AnimationTimeline): KeyframePoint[] {
  return [...timeline.keyframes].sort((a, b) => a.offset - b.offset);
}

export interface KeyframeDeclarationOptions {
  /** Emits `-webkit-` aliases for `transform` and `filter`. */
  includeVendorPrefixes?: boolean;
}

/** Declarations emitted inside a single keyframe block. */
export function generateKeyframeDeclarations(
  keyframe: KeyframePoint,
  options: KeyframeDeclarationOptions = {},
): string[] {
  const { includeVendorPrefixes = false } = options;
  const transform = composeTransformCSS(keyframe.properties.transform);
  const filter = composeFilterCSS(keyframe.properties.filter);
  const s = keyframe.properties.styles;

  const declarations: string[] = [];
  if (includeVendorPrefixes) {
    declarations.push(`-webkit-transform: ${transform};`, `-webkit-filter: ${filter};`);
  }
  declarations.push(
    `transform: ${transform};`,
    `filter: ${filter};`,
    `opacity: ${formatCssNumber(s.opacity)};`,
    `background-color: ${s.backgroundColor};`,
    `border-color: ${s.borderColor};`,
    `border-width: ${formatCssNumber(s.borderWidth)}px;`,
    `border-radius: ${formatCssNumber(s.borderRadius)}px;`,
    `box-shadow: ${composeBoxShadowCSS(s)};`,
    `transform-origin: ${formatCssNumber(s.transformOriginX)}% ${formatCssNumber(s.transformOriginY)}%;`,
  );
  return declarations;
}

/**
 * Generates a `@keyframes` block.
 *
 * A keyframe's `animation-timing-function` applies to the segment that starts
 * at that keyframe, so the terminal 100% keyframe never declares one.
 */
export function generateVanillaCSSKeyframes(timeline: AnimationTimeline, ruleName: string): string {
  const sorted = getSortedKeyframes(timeline);
  const keyframeBlocks = sorted.map((kf) => {
    const easingDeclaration =
      kf.offset === 100 ? '' : `animation-timing-function: ${formatTiming(kf.timingFunction, kf.bezier)};`;
    const declarations = [...generateKeyframeDeclarations(kf), easingDeclaration].filter(
      (declaration): declaration is string => declaration.length > 0,
    );
    const body = declarations.map((declaration) => `    ${declaration}`).join('\n');
    return `  ${formatCssNumber(kf.offset, 2)}% {\n${body}\n  }`;
  });

  return `@keyframes ${ruleName} {\n${keyframeBlocks.join('\n')}\n}`;
}

/** Generates the `animation` shorthand declaration body (without the property name). */
export function generateAnimationShorthand(timeline: AnimationTimeline, ruleName: string): string {
  const duration = formatMillisecondsAsSeconds(timeline.durationMs);
  const delay = timeline.delayMs > 0 ? formatMillisecondsAsSeconds(timeline.delayMs) : '0s';
  const iter = formatIterationCount(timeline.iterationCount);
  return `${ruleName} ${duration} linear ${delay} ${iter} ${timeline.direction} ${timeline.fillMode}`;
}

/** Generates the full shorthand declaration, e.g. `animation: name 1.00s ...;`. */
export function generateAnimationDeclaration(timeline: AnimationTimeline, ruleName: string): string {
  return `animation: ${generateAnimationShorthand(timeline, ruleName)};`;
}

/** CSS custom properties describing the timeline, for `includeVariables` exports. */
export function generateTimelineVariables(timeline: AnimationTimeline, prefix = '--anim'): string {
  return [
    `${prefix}-name: ${timeline.name};`,
    `${prefix}-duration: ${formatMillisecondsAsSeconds(timeline.durationMs)};`,
    `${prefix}-delay: ${formatMillisecondsAsSeconds(timeline.delayMs)};`,
    `${prefix}-iterations: ${formatIterationCount(timeline.iterationCount)};`,
    `${prefix}-direction: ${timeline.direction};`,
    `${prefix}-fill-mode: ${timeline.fillMode};`,
  ].join('\n');
}

/**
 * Produces a complete, copy-pasteable stylesheet for one timeline: theme
 * variables (optional), vendor-prefixed keyframes (optional), the keyframes
 * block, and the animation class that references it.
 */
export function generateVanillaStylesheet(
  timeline: AnimationTimeline,
  options: Pick<ExportOptions, 'animationClassName' | 'keyframeRuleName' | 'includeVendorPrefixes' | 'includeVariables' | 'prettify'>,
): string {
  const className = normalizeCssIdentifier(options.animationClassName, 'studio-animation');
  const ruleName = normalizeCssIdentifier(options.keyframeRuleName, 'studio-animation');
  const { includeVendorPrefixes, includeVariables, prettify } = options;

  const keyframes = generateVanillaCSSKeyframes(timeline, ruleName);
  const blocks: string[] = [];

  if (includeVariables) {
    const variables = generateTimelineVariables(timeline)
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');
    blocks.push(
      prettify
        ? `/* Timeline tokens — override these to re-theme the exported animation. */\n:root {\n${variables}\n}`
        : `:root{${generateTimelineVariables(timeline)}}`,
    );
  }

  if (includeVendorPrefixes) {
    const webkitBody = keyframes.slice('@keyframes '.length);
    blocks.push(
      prettify
        ? `/* Safari / legacy WebKit alias */\n@-webkit-keyframes ${ruleName} {\n${webkitBody}\n}`
        : `@-webkit-keyframes ${ruleName} {\n${webkitBody}\n}`,
    );
  }
  blocks.push(keyframes);

  const shorthand = generateAnimationShorthand(timeline, ruleName);
  blocks.push(
    prettify
      ? `/* Apply with: <div class="${className}"></div> */\n.${className} {\n  animation: ${shorthand};\n  will-change: transform, filter, opacity;\n}`
      : `.${className}{animation:${shorthand};will-change:transform,filter,opacity;}`,
  );

  return `${blocks.join('\n\n')}\n`;
}
// ---------------------------------------------------------------------------
// Web Animations API
// ---------------------------------------------------------------------------

/** Maps the domain iteration model onto the WAAPI `iterations` option. */
export function toWaapiIterations(iteration: AnimationIteration): number {
  return iteration === 'infinite' ? Infinity : Math.max(1, iteration);
}

/** Builds the WAAPI keyframe array for a timeline, skipping easing on the last frame. */
export function generateWaapiKeyframes(timeline: AnimationTimeline): Keyframe[] {
  const sorted = getSortedKeyframes(timeline);
  return sorted.map((kf, index) => {
    const isTerminal = index === sorted.length - 1;
    const s = kf.properties.styles;
    const frame: Keyframe = {
      offset: kf.offset / 100,
      transform: composeTransformCSS(kf.properties.transform),
      filter: composeFilterCSS(kf.properties.filter),
      opacity: s.opacity,
      backgroundColor: s.backgroundColor,
      borderColor: s.borderColor,
      borderWidth: `${formatCssNumber(s.borderWidth)}px`,
      borderRadius: `${formatCssNumber(s.borderRadius)}px`,
      boxShadow: composeBoxShadowCSS(s),
      transformOrigin: `${formatCssNumber(s.transformOriginX)}% ${formatCssNumber(s.transformOriginY)}%`,
      ...(isTerminal ? {} : { easing: formatTiming(kf.timingFunction, kf.bezier) }),
    };
    return frame;
  });
}

/**
 * Creates the canonical `Animation` for a node.
 * Returns `null` when the timeline has fewer than two keyframes, which is the
 * single case where the WAAPI cannot produce a valid effect.
 */
export function createCanonicalWaapiAnimation(
  node: HTMLElement,
  timeline: AnimationTimeline,
  mode: 'scrub' | 'playback',
): Animation | null {
  if (typeof node?.animate !== 'function') return null;
  const keyframes = generateWaapiKeyframes(timeline);
  if (keyframes.length < 2) return null;

  const options: KeyframeAnimationOptions =
    mode === 'playback'
      ? {
          duration: timeline.durationMs,
          delay: timeline.delayMs,
          iterations: toWaapiIterations(timeline.iterationCount),
          direction: timeline.direction,
          fill: timeline.fillMode,
        }
      : { duration: timeline.durationMs, fill: 'both' };

  return node.animate(keyframes, options);
}

/**
 * Poses a node at a given progress ratio using a paused scrub animation.
 * Any previously created scrub animation on the node is cancelled first so
 * rapid pointer scrubbing cannot stack effects.
 */
export function applyScrubToDOMNode(
  node: HTMLElement,
  timeline: AnimationTimeline,
  progressRatio: number,
): Animation | null {
  cancelScrubAnimations(node);
  const animation = createCanonicalWaapiAnimation(node, timeline, 'scrub');
  if (!animation) return null;
  animation.pause();
  const ratio = Number.isFinite(progressRatio) ? progressRatio : 0;
  animation.currentTime = Math.min(timeline.durationMs, Math.max(0, timeline.durationMs * ratio));
  return animation;
}

const SCRUB_ANIMATION_FLAG = '__cssSandboxScrubAnimation';

/** Cancels the scrub animation previously attached to `node`, if any. */
export function cancelScrubAnimations(node: HTMLElement | null | undefined): void {
  if (!node) return;
  const existing = (node as HTMLElement & Record<string, unknown>)[SCRUB_ANIMATION_FLAG] as Animation | undefined;
  if (existing && typeof existing.cancel === 'function') {
    existing.cancel();
  }
  (node as HTMLElement & Record<string, unknown>)[SCRUB_ANIMATION_FLAG] = undefined;
}

/** Remembers the active scrub animation so it can be cancelled later. */
export function trackScrubAnimation(node: HTMLElement, animation: Animation | null): void {
  (node as HTMLElement & Record<string, unknown>)[SCRUB_ANIMATION_FLAG] = animation ?? undefined;
}

/** TypeScript-friendly source snippet for the WAAPI export target. */
export function generateWebAnimationsApiCode(
  timeline: AnimationTimeline,
  options: Pick<ExportOptions, 'animationClassName' | 'keyframeRuleName' | 'prettify'>,
): string {
  const ruleName = normalizeCssIdentifier(options.keyframeRuleName, 'studio-animation');
  const frame = (kf: KeyframePoint, index: number, total: number): string => {
    const s = kf.properties.styles;
    const entries = [
      `offset: ${formatCssNumber(kf.offset / 100, 4)}`,
      `transform: '${composeTransformCSS(kf.properties.transform)}'`,
      `filter: '${composeFilterCSS(kf.properties.filter)}'`,
      `opacity: ${formatCssNumber(s.opacity)}`,
      `backgroundColor: '${s.backgroundColor}'`,
      `borderRadius: '${formatCssNumber(s.borderRadius)}px'`,
    ];
    if (index < total - 1) {
      entries.push(`easing: '${formatTiming(kf.timingFunction, kf.bezier)}'`);
    }
    return options.prettify
      ? `    { ${entries.join(', ')} },`
      : `{${entries.join(',')}},`;
  };

  const keyframes = getSortedKeyframes(timeline).map((kf, index, all) => frame(kf, index, all.length));
  const optionsEntries = [
    `duration: ${Math.round(timeline.durationMs)}`,
    `delay: ${Math.round(timeline.delayMs)}`,
    `iterations: ${toWaapiIterations(timeline.iterationCount)}`,
    `direction: '${timeline.direction}'`,
    `fill: '${timeline.fillMode}'`,
  ];

  return `const ${ruleName}Keyframes: Keyframe[] = [
${keyframes.join('\n')}
];

const target = document.querySelector<HTMLElement>('.${normalizeCssIdentifier(options.animationClassName, 'studio-animation')}');

if (target) {
  const animation = target.animate(${ruleName}Keyframes, {
${options.prettify ? optionsEntries.map((entry) => `    ${entry},`).join('\n') : `${optionsEntries.join(',')}`}
  });

  animation.play();
}
`;
}

// ---------------------------------------------------------------------------
// Scrub geometry (pure pointer math, no event binding)
// ---------------------------------------------------------------------------

/** Converts a viewport X coordinate into a clamped 0–100 timeline percentage. */
export function computeScrubPercentage(clientX: number, trackBoundingRect: DOMRect): number {
  if (trackBoundingRect.width === 0) return 0;
  const relativeX = clientX - trackBoundingRect.left;
  const rawPercentage = (relativeX / trackBoundingRect.width) * 100;
  return Math.min(Math.max(rawPercentage, 0), 100);
}

/** Converts a clamped percentage into a 0–1 progress ratio. */
export function percentageToProgressRatio(percentage: number): number {
  if (!Number.isFinite(percentage)) return 0;
  return Math.min(Math.max(percentage, 0), 100) / 100;
}

/** Converts a 0–1 progress ratio into a clamped 0–100 percentage. */
export function progressRatioToPercentage(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(Math.max(ratio, 0), 1) * 100;
}

/** Maps a playhead time (ms) to a 0–1 progress ratio for the given timeline. */
export function timeToProgressRatio(timeMs: number, timeline: AnimationTimeline): number {
  if (timeline.durationMs <= 0) return 0;
  return percentageToProgressRatio((timeMs / timeline.durationMs) * 100);
}

/** Maps a 0–1 progress ratio back to a playhead time (ms). */
export function progressRatioToTime(ratio: number, timeline: AnimationTimeline): number {
  return Math.min(Math.max(ratio, 0), 1) * timeline.durationMs;
}

/** Formats a millisecond position as `m:ss.mmm` for timeline counters. */
export function formatTimecode(timeMs: number): string {
  const safe = Math.max(0, Number.isFinite(timeMs) ? timeMs : 0);
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const milliseconds = Math.floor(safe % 1_000);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

export interface KeyframeSegment {
  from: KeyframePoint;
  to: KeyframePoint;
  /** Progress of `offset` inside the `[from, to]` interval, in `[0, 1]`. */
  localProgress: number;
}

/**
 * Resolves the keyframe pair that brackets a given percentage, applying the
 * outgoing keyframe's easing so callers can interpolate a live preview without
 * the Web Animations API. Returns `null` for an empty timeline.
 */
export function resolveSegmentAtOffset(
  timeline: AnimationTimeline,
  offsetPercentage: number,
): KeyframeSegment | null {
  const sorted = getSortedKeyframes(timeline);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) {
    return { from: sorted[0], to: sorted[0], localProgress: 0 };
  }

  const offset = Math.min(Math.max(Number.isFinite(offsetPercentage) ? offsetPercentage : 0, 0), 100);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (offset <= first.offset) return { from: first, to: first, localProgress: 0 };
  if (offset >= last.offset) return { from: last, to: last, localProgress: 1 };

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const from = sorted[index];
    const to = sorted[index + 1];
    if (offset >= from.offset && offset <= to.offset) {
      const span = to.offset - from.offset;
      const localProgress = span === 0 ? 0 : (offset - from.offset) / span;
      return { from, to, localProgress };
    }
  }

  return { from: last, to: last, localProgress: 1 };
}
