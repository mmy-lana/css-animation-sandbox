/**
 * Starter timelines offered by the preset drawer.
 *
 * Presets are data, not UI: each entry is a fully-formed `AnimationTimeline`
 * built with the same factories the rest of the app uses, so applying one
 * cannot produce a timeline the domain model would reject. `build()` returns a
 * fresh instance every call because keyframe ids are part of the persisted
 * document and must never be shared between two projects.
 */

import { createKeyframePoint, createTimeline, type AnimationTimeline, type PreviewConfig } from '@/types/sandbox';
import { UNIT_BEZIER_PRESETS, type NamedTimingPreset } from '@/lib/bezier';

export type PresetCategory = 'motion' | 'attention' | 'material' | 'type';

export interface AnimationPreset {
  id: string;
  name: string;
  category: PresetCategory;
  description: string;
  /** Preview settings that best show the preset. */
  preview: Partial<PreviewConfig>;
  build: () => AnimationTimeline;
}

export const PRESET_CATEGORY_LABELS: Readonly<Record<PresetCategory, string>> = {
  motion: 'Motion',
  attention: 'Attention',
  material: 'Material',
  type: 'Typography',
};

/** Helper that pairs a named timing keyword with the keyframes it eases. */
function timed(
  timingFunction: NamedTimingPreset,
  offset: number,
  properties: Parameters<typeof createKeyframePoint>[0]['properties'],
): ReturnType<typeof createKeyframePoint> {
  return createKeyframePoint({
    offset,
    timingFunction,
    bezier: { ...UNIT_BEZIER_PRESETS[timingFunction] },
    properties,
  });
}

export const ANIMATION_PRESETS: readonly AnimationPreset[] = [
  {
    id: 'lift-and-settle',
    name: 'Lift & Settle',
    category: 'motion',
    description: 'A card rises, overshoots slightly and settles — the everyday UI entrance.',
    preview: { shape: 'card', stageLightingIntensity: 0.7 },
    build: () =>
      createTimeline({
        name: 'Lift & Settle',
        durationMs: 900,
        fillMode: 'both',
        keyframes: [
          timed('ease-out', 0, {
            transform: { translateY: 40, scaleX: 1, scaleY: 1 },
            styles: { opacity: 0, boxShadowBlur: 8, boxShadowSpread: 0 },
          }),
          createKeyframePoint({
            offset: 65,
            timingFunction: 'ease-out',
            bezier: { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
            properties: {
              transform: { translateY: -8, scaleX: 1.04, scaleY: 1.04 },
              styles: { opacity: 1, boxShadowBlur: 56, boxShadowSpread: -14 },
            },
          }),
          timed('ease-in-out', 100, {
            transform: { translateY: 0, scaleX: 1, scaleY: 1 },
            styles: { opacity: 1, boxShadowBlur: 48, boxShadowSpread: -12 },
          }),
        ],
      }),
  },
  {
    id: 'spin-flip',
    name: 'Spin Flip',
    category: 'motion',
    description: 'A full Y-axis flip on a 3D cube, looping continuously for inspection.',
    preview: { shape: 'cube', showPerspectiveGuide: true },
    build: () =>
      createTimeline({
        name: 'Spin Flip',
        durationMs: 1600,
        iterationCount: 'infinite',
        direction: 'alternate',
        keyframes: [
          timed('ease-in-out', 0, { transform: { rotateY: 0, rotateX: -12 } }),
          timed('ease-in-out', 50, { transform: { rotateY: 180, rotateX: 12 } }),
          timed('ease-in-out', 100, { transform: { rotateY: 360, rotateX: -12 } }),
        ],
      }),
  },
  {
    id: 'pulse-ring',
    name: 'Pulse Ring',
    category: 'attention',
    description: 'A badge breathes with an expanding shadow — an unobtrusive attention cue.',
    preview: { shape: 'badge', enableMotionTrails: false },
    build: () =>
      createTimeline({
        name: 'Pulse Ring',
        durationMs: 1800,
        iterationCount: 'infinite',
        direction: 'alternate',
        keyframes: [
          timed('ease-in', 0, {
            transform: { scaleX: 1, scaleY: 1 },
            styles: { boxShadowBlur: 28, boxShadowSpread: -4, boxShadowColor: 'rgba(0, 245, 212, 0.25)' },
          }),
          timed('ease-out', 50, {
            transform: { scaleX: 1.06, scaleY: 1.06 },
            filter: { brightness: 115 },
            styles: { boxShadowBlur: 60, boxShadowSpread: -16, boxShadowColor: 'rgba(0, 245, 212, 0.55)' },
          }),
          timed('ease-in', 100, {
            transform: { scaleX: 1, scaleY: 1 },
            filter: { brightness: 100 },
            styles: { boxShadowBlur: 28, boxShadowSpread: -4, boxShadowColor: 'rgba(0, 245, 212, 0.25)' },
          }),
        ],
      }),
  },
  {
    id: 'glitch-shard',
    name: 'Glitch Shard',
    category: 'attention',
    description: 'A stepped, jittering transform with a hue shift — deliberately harsh easing.',
    preview: { shape: 'card', enableMotionTrails: true, stageLightingIntensity: 0.35 },
    build: () =>
      createTimeline({
        name: 'Glitch Shard',
        durationMs: 1200,
        iterationCount: 3,
        direction: 'alternate',
        keyframes: [
          timed('step-start', 0, { transform: { translateX: 0, skewX: 0, scaleX: 1.15, scaleY: 0.8 } }),
          timed('step-end', 25, {
            transform: { translateX: 14, skewX: 12, scaleX: 1, scaleY: 1 },
            filter: { hueRotate: 140, saturate: 160 },
          }),
          timed('step-start', 50, { transform: { translateX: -10, skewX: -8, scaleX: 0.94, scaleY: 1.1 } }),
          timed('step-end', 75, {
            transform: { translateX: 6, skewX: 4, scaleX: 1.02, scaleY: 0.98 },
            filter: { hueRotate: 0, saturate: 100 },
          }),
          timed('linear', 100, { transform: { translateX: 0, skewX: 0, scaleX: 1, scaleY: 1 } }),
        ],
      }),
  },
  {
    id: 'glass-refraction',
    name: 'Glass Refraction',
    category: 'material',
    description: 'Blur, saturate and backdrop shift: a frosted panel forming in 3D depth.',
    preview: { shape: 'card', stageLightingIntensity: 0.9, viewportBackground: 'dots' },
    build: () =>
      createTimeline({
        name: 'Glass Refraction',
        durationMs: 1400,
        fillMode: 'both',
        keyframes: [
          timed('ease-out', 0, {
            transform: { translateZ: -160, rotateX: 25, scaleX: 0.86, scaleY: 0.86 },
            filter: { blur: 18, saturate: 60, brightness: 70 },
            styles: { opacity: 0, borderRadius: 32, backgroundColor: '#0f172a' },
          }),
          createKeyframePoint({
            offset: 60,
            timingFunction: 'ease-out',
            bezier: { x1: 0.16, y1: 1, x2: 0.3, y2: 1 },
            properties: {
              transform: { translateZ: 40, rotateX: -6, scaleX: 1.03, scaleY: 1.03 },
              filter: { blur: 0, saturate: 140, brightness: 110 },
              styles: { opacity: 1, borderRadius: 16, backgroundColor: '#111827' },
            },
          }),
          timed('ease-in-out', 100, {
            transform: { translateZ: 0, rotateX: 0, scaleX: 1, scaleY: 1 },
            filter: { blur: 0, saturate: 100, brightness: 100 },
            styles: { opacity: 1, borderRadius: 16, backgroundColor: '#111827' },
          }),
        ],
      }),
  },
  {
    id: 'sheen-sweep',
    name: 'Sheen Sweep',
    category: 'material',
    description: 'A specular highlight travels across a skewed surface as the panel tilts.',
    preview: { shape: 'card', viewportBackground: 'solid-obsidian' },
    build: () =>
      createTimeline({
        name: 'Sheen Sweep',
        durationMs: 2200,
        iterationCount: 'infinite',
        direction: 'alternate',
        keyframes: [
          timed('ease-in-out', 0, {
            transform: { skewX: -18, translateX: -30 },
            filter: { brightness: 92, contrast: 110 },
            styles: { backgroundColor: '#1e1b4b' },
          }),
          timed('ease-in-out', 50, {
            transform: { skewX: 0, translateX: 0 },
            filter: { brightness: 130, contrast: 100 },
            styles: { backgroundColor: '#312e81' },
          }),
          timed('ease-in-out', 100, {
            transform: { skewX: 18, translateX: 30 },
            filter: { brightness: 92, contrast: 110 },
            styles: { backgroundColor: '#1e1b4b' },
          }),
        ],
      }),
  },
  {
    id: 'kinetic-headline',
    name: 'Kinetic Headline',
    category: 'type',
    description: 'Staggered letter entrances driven by a stepped easing on a typography target.',
    preview: { shape: 'typography', viewportBackground: 'grid-dark' },
    build: () =>
      createTimeline({
        name: 'Kinetic Headline',
        durationMs: 1500,
        fillMode: 'both',
        keyframes: [
          timed('ease-out', 0, {
            transform: { translateY: 60, scaleX: 0.92, scaleY: 0.92 },
            filter: { blur: 12 },
            styles: { opacity: 0, borderWidth: 0, borderRadius: 4 },
          }),
          createKeyframePoint({
            offset: 55,
            timingFunction: 'ease-out',
            bezier: { x1: 0.2, y1: 0.9, x2: 0.25, y2: 1.1 },
            properties: {
              transform: { translateY: -6, scaleX: 1.02, scaleY: 1.02 },
              filter: { blur: 0 },
              styles: { opacity: 1, borderWidth: 2, borderRadius: 12 },
            },
          }),
          timed('step-end', 75, {
            transform: { translateY: 0, scaleX: 1, scaleY: 1 },
            styles: { opacity: 1, borderWidth: 2, borderRadius: 12 },
          }),
          timed('ease-in-out', 100, {
            transform: { translateY: 0, scaleX: 1, scaleY: 1 },
            styles: { opacity: 0.85, borderWidth: 1, borderRadius: 10 },
          }),
        ],
      }),
  },
  {
    id: 'elastic-pop',
    name: 'Elastic Pop',
    category: 'motion',
    description: 'A springy scale pop with a custom overshoot curve on every iteration.',
    preview: { shape: 'sphere', stageLightingIntensity: 0.8 },
    build: () =>
      createTimeline({
        name: 'Elastic Pop',
        durationMs: 1100,
        iterationCount: 'infinite',
        direction: 'alternate',
        keyframes: [
          createKeyframePoint({
            offset: 0,
            timingFunction: 'custom-cubic',
            bezier: { x1: 0.68, y1: -0.55, x2: 0.27, y2: 1.55 },
            properties: {
              transform: { scaleX: 0.8, scaleY: 0.8, translateY: 10 },
              filter: { saturate: 80 },
            },
          }),
          createKeyframePoint({
            offset: 45,
            timingFunction: 'custom-cubic',
            bezier: { x1: 0.5, y1: 0, x2: 0.5, y2: 1 },
            properties: {
              transform: { scaleX: 1.18, scaleY: 0.92, translateY: -24 },
              filter: { saturate: 140, brightness: 112 },
            },
          }),
          createKeyframePoint({
            offset: 70,
            timingFunction: 'custom-cubic',
            bezier: { x1: 0.3, y1: 0, x2: 0.3, y2: 1 },
            properties: {
              transform: { scaleX: 0.95, scaleY: 1.06, translateY: 4 },
              filter: { saturate: 110 },
            },
          }),
          createKeyframePoint({
            offset: 100,
            timingFunction: 'ease-in-out',
            bezier: { ...UNIT_BEZIER_PRESETS['ease-in-out'] },
            properties: {
              transform: { scaleX: 1, scaleY: 1, translateY: 0 },
              filter: { saturate: 100 },
            },
          }),
        ],
      }),
  },
] as const;

/**
 * Resolves a timeline name that is free within `taken`, appending the smallest
 * numeric suffix that does not collide: "Elastic Pop" → "Elastic Pop 2" → "3".
 * Comparison is case-insensitive because the drawer shows these side by side.
 */
export function resolveUniqueTimelineName(name: string, taken: Iterable<string>): string {
  const used = new Set(Array.from(taken, (entry) => entry.trim().toLowerCase()));
  const trimmed = name.trim();
  if (!used.has(trimmed.toLowerCase())) return trimmed;
  let suffix = 2;
  while (used.has(`${trimmed.toLowerCase()} ${suffix}`)) suffix += 1;
  return `${trimmed} ${suffix}`;
}

/** Groups presets by category, preserving catalog order within each group. */
export function groupPresetsByCategory(
  presets: readonly AnimationPreset[] = ANIMATION_PRESETS,
): Array<{ category: PresetCategory; label: string; presets: AnimationPreset[] }> {
  const groups = new Map<PresetCategory, AnimationPreset[]>();
  for (const preset of presets) {
    const bucket = groups.get(preset.category);
    if (bucket) bucket.push(preset);
    else groups.set(preset.category, [preset]);
  }
  return Array.from(groups.entries(), ([category, items]) => ({
    category,
    label: PRESET_CATEGORY_LABELS[category],
    presets: items,
  }));
}
