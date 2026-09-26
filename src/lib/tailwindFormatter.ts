/**
 * Tailwind CSS v4 serializer.
 *
 * Tailwind v4 is CSS-first: design tokens live in `@theme`, and a token named
 * `--animate-<name>` automatically produces an `animate-<name>` utility. This
 * module emits that exact contract — a `@theme` block, the matching
 * `@keyframes` block, an explicit `@utility` alias and a usage example — so the
 * exported snippet works by dropping it into a v4 stylesheet.
 *
 * Server-safe and pure.
 */

import {
  formatIterationCount,
  formatMillisecondsAsSeconds,
  generateVanillaCSSKeyframes,
  normalizeCssIdentifier,
} from '@/lib/cssGenerator';
import type { AnimationTimeline, ExportOptions } from '@/types/sandbox';

/** Normalises any animation name into a Tailwind token segment. */
export function toTailwindTokenName(animationName: string): string {
  return normalizeCssIdentifier(animationName, 'studio-animation');
}

/** The animation shorthand as it is stored inside `--animate-<name>`. */
export function formatTailwindAnimationShorthand(timeline: AnimationTimeline, animationName: string): string {
  const duration = formatMillisecondsAsSeconds(timeline.durationMs);
  const delay = timeline.delayMs > 0 ? ` ${formatMillisecondsAsSeconds(timeline.delayMs)}` : '';
  const iterations = formatIterationCount(timeline.iterationCount);
  return `${animationName} ${duration} linear${delay} ${iterations} ${timeline.direction} ${timeline.fillMode}`;
}

/** The `@theme` block that registers the animation token. */
export function generateTailwindThemeBlock(timeline: AnimationTimeline, animationName: string): string {
  return `@theme {\n  --animate-${animationName}: ${formatTailwindAnimationShorthand(timeline, animationName)};\n}`;
}

/**
 * An explicit `@utility` alias. Tailwind v4 already derives `animate-<name>`
 * from the `--animate-<name>` token, but emitting the utility keeps the snippet
 * self-documenting and lets consumers extend the rule later.
 */
export function generateTailwindUtilityBlock(animationName: string, includeWillChange: boolean): string {
  const willChange = includeWillChange ? '\n  will-change: transform, filter, opacity;' : '';
  return `@utility animate-${animationName} {\n  animation: var(--animate-${animationName});${willChange}\n}`;
}

/** The copy-paste usage example rendered above the CSS blocks. */
export function formatTailwindUsageExample(animationName: string, prettify = true): string {
  const element = `<div class="animate-${animationName}">Animated</div>`;
  if (!prettify) return `/* Usage: ${element} */`;
  return `/* Tailwind CSS v4 Theme Extension
 * Usage: ${element}
 */`;
}

/**
 * Generates a ready-to-use Tailwind v4 `@theme` extension.
 *
 * @param timeline  Source timeline for duration, delay, iterations and keyframes.
 * @param animationName  Animation name; also the keyframe rule name and the
 *                       suffix of both the `--animate-*` token and the
 *                       `animate-*` utility.
 */
export function generateTailwindV4CSS(timeline: AnimationTimeline, animationName: string): string {
  const name = toTailwindTokenName(animationName);
  const keyframesBlock = generateVanillaCSSKeyframes(timeline, name);

  return `/* Tailwind CSS v4 Theme Extension
 * Usage: <div class="animate-${name}">...</div>
 */
@theme {
  --animate-${name}: ${formatTailwindAnimationShorthand(timeline, name)};
}

${keyframesBlock}`;
}

export interface TailwindExportOptions
  extends Pick<ExportOptions, 'animationClassName' | 'keyframeRuleName' | 'includeVendorPrefixes' | 'prettify'> {
  /** Emits an explicit `@utility animate-*` block alongside the theme token. */
  includeUtilityBlock?: boolean;
}

/**
 * Full Tailwind v4 export: theme token, optional vendor-prefixed keyframes,
 * the keyframes block, an optional utility alias and a usage example.
 */
export function generateTailwindV4Stylesheet(
  timeline: AnimationTimeline,
  options: TailwindExportOptions,
): string {
  const name = toTailwindTokenName(options.keyframeRuleName || options.animationClassName);
  const { includeUtilityBlock = true, includeVendorPrefixes = false, prettify = true } = options;

  const blocks: string[] = [generateTailwindThemeBlock(timeline, name)];

  const keyframes = generateVanillaCSSKeyframes(timeline, name);
  if (includeVendorPrefixes) {
    blocks.push(`@-webkit-keyframes ${name} {\n${keyframes.slice('@keyframes '.length)}\n}`);
  }
  blocks.push(keyframes);

  if (includeUtilityBlock) {
    blocks.push(generateTailwindUtilityBlock(name, true));
  }

  const header = prettify
    ? formatTailwindUsageExample(name, true)
    : formatTailwindUsageExample(name, false);

  return `${header}\n${blocks.join('\n\n')}\n`;
}
