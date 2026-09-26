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
  {
    id: 'float-levitate',
    name: 'Float Levitate',
    category: 'motion',
    description: 'A card hangs in a slow vertical drift with a slight pitch, as if suspended in depth.',
    preview: { shape: 'card', showPerspectiveGuide: true, stageLightingIntensity: 0.55, enableMotionTrails: false },
    build: () =>
      createTimeline({
        name: 'Float Levitate',
        durationMs: 3400,
        iterationCount: 'infinite',
        direction: 'alternate',
        fillMode: 'both',
        keyframes: [
          timed('ease-in-out', 0, {
            transform: { translateY: 22, translateZ: -28, rotateX: 7, rotateZ: -1.5, scaleX: 1, scaleY: 1 },
            styles: { boxShadowY: 24, boxShadowBlur: 18, boxShadowSpread: -6 },
          }),
          timed('ease-in-out', 28, {
            transform: { translateY: -10, translateZ: 18, rotateX: 3.5, rotateZ: 1, scaleX: 1.02, scaleY: 1.02 },
            styles: { boxShadowY: 32, boxShadowBlur: 52, boxShadowSpread: -16 },
          }),
          timed('ease-in-out', 62, {
            transform: { translateY: 6, translateZ: -8, rotateX: 8.5, rotateZ: -0.8, scaleX: 0.99, scaleY: 0.99 },
            styles: { boxShadowY: 26, boxShadowBlur: 30, boxShadowSpread: -9 },
          }),
          // The alternate loop plays 100% back to 0%, so the closing pose has to
          // reproduce the opening one or every cycle ends on a visible jump.
          timed('ease-in-out', 100, {
            transform: { translateY: 22, translateZ: -28, rotateX: 7, rotateZ: -1.5, scaleX: 1, scaleY: 1 },
            styles: { boxShadowY: 24, boxShadowBlur: 18, boxShadowSpread: -6 },
          }),
        ],
      }),
  },
  {
    id: 'neon-bloom',
    name: 'Neon Bloom',
    category: 'attention',
    description: 'A rhythmic cyan-to-violet border glow that blooms outward, then settles back to its resting hue.',
    preview: { shape: 'badge', viewportBackground: 'solid-obsidian', stageLightingIntensity: 0.3 },
    build: () =>
      createTimeline({
        name: 'Neon Bloom',
        durationMs: 1500,
        iterationCount: 'infinite',
        direction: 'alternate',
        fillMode: 'both',
        keyframes: [
          timed('ease-in', 0, {
            transform: { scaleX: 1, scaleY: 1 },
            filter: { blur: 1.5, brightness: 92, saturate: 110 },
            styles: {
              borderColor: '#00f5d4',
              borderWidth: 2,
              boxShadowColor: 'rgba(0, 245, 212, 0.30)',
              boxShadowBlur: 18,
              boxShadowSpread: -4,
            },
          }),
          timed('ease-out', 38, {
            transform: { scaleX: 1.05, scaleY: 1.05 },
            filter: { blur: 0, brightness: 138, saturate: 170 },
            styles: {
              borderColor: '#22d3ee',
              borderWidth: 3,
              boxShadowColor: 'rgba(124, 58, 237, 0.55)',
              boxShadowBlur: 54,
              boxShadowSpread: -18,
            },
          }),
          timed('ease-in-out', 68, {
            transform: { scaleX: 1.01, scaleY: 1.01 },
            filter: { blur: 0.5, brightness: 118, saturate: 140 },
            styles: {
              borderColor: '#a855f7',
              borderWidth: 3,
              boxShadowColor: 'rgba(168, 85, 247, 0.45)',
              boxShadowBlur: 64,
              boxShadowSpread: -24,
            },
          }),
          timed('ease-in', 100, {
            transform: { scaleX: 1, scaleY: 1 },
            filter: { blur: 1.5, brightness: 92, saturate: 110 },
            styles: {
              borderColor: '#00f5d4',
              borderWidth: 2,
              boxShadowColor: 'rgba(0, 245, 212, 0.30)',
              boxShadowBlur: 18,
              boxShadowSpread: -4,
            },
          }),
        ],
      }),
  },
  {
    id: 'isometric-tumble',
    name: 'Isometric Tumble',
    category: 'motion',
    description: 'A cube rolls through a full 360° turn, punching out in Z depth on every quarter rotation.',
    preview: { shape: 'cube', showAxes: true, showPerspectiveGuide: true, stageLightingIntensity: 0.8 },
    build: () =>
      createTimeline({
        name: 'Isometric Tumble',
        durationMs: 2400,
        iterationCount: 'infinite',
        fillMode: 'both',
        keyframes: [
          // The launch curves overshoot past 1 so the cube springs off the plane
          // before it settles into the next quarter turn.
          createKeyframePoint({
            offset: 0,
            timingFunction: 'custom-cubic',
            bezier: { x1: 0.3, y1: 1.28, x2: 0.42, y2: 1 },
            properties: {
              transform: { rotateX: 0, rotateY: 0, rotateZ: 0, translateZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
              styles: { boxShadowBlur: 24, boxShadowSpread: -8 },
            },
          }),
          timed('ease-out', 25, {
            transform: { rotateX: -30, rotateY: 90, rotateZ: 8, translateZ: 100, scaleX: 0.93, scaleY: 0.93, scaleZ: 1.08 },
            styles: { boxShadowBlur: 72, boxShadowSpread: -22 },
          }),
          createKeyframePoint({
            offset: 50,
            timingFunction: 'custom-cubic',
            bezier: { x1: 0.3, y1: 1.28, x2: 0.42, y2: 1 },
            properties: {
              transform: { rotateX: 0, rotateY: 180, rotateZ: 0, translateZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
              styles: { boxShadowBlur: 24, boxShadowSpread: -8 },
            },
          }),
          timed('ease-out', 75, {
            transform: { rotateX: 30, rotateY: 270, rotateZ: -8, translateZ: 100, scaleX: 0.93, scaleY: 0.93, scaleZ: 1.08 },
            styles: { boxShadowBlur: 72, boxShadowSpread: -22 },
          }),
          // A full 360° yaw returns to the opening orientation, so the infinite
          // loop restarts without a visible discontinuity.
          createKeyframePoint({
            offset: 100,
            timingFunction: 'custom-cubic',
            bezier: { x1: 0.3, y1: 1.28, x2: 0.42, y2: 1 },
            properties: {
              transform: { rotateX: 0, rotateY: 360, rotateZ: 0, translateZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
              styles: { boxShadowBlur: 24, boxShadowSpread: -8 },
            },
          }),
        ],
      }),
  },
  {
    id: 'shutter-reveal',
    name: 'Shutter Reveal',
    category: 'material',
    description: 'A camera-shutter snap: the frame squeezes open, overshoots, and settles as its blur clears.',
    preview: { shape: 'card', viewportBackground: 'checkerboard', stageLightingIntensity: 0.45 },
    build: () =>
      createTimeline({
        name: 'Shutter Reveal',
        durationMs: 850,
        fillMode: 'both',
        keyframes: [
          timed('ease-in', 0, {
            transform: { scaleX: 0.08, scaleY: 1, translateZ: -60 },
            filter: { blur: 16, contrast: 45, brightness: 55, saturate: 60 },
            styles: { opacity: 0, backgroundColor: '#09090b', borderRadius: 2 },
          }),
          timed('ease-out', 22, {
            transform: { scaleX: 0.44, scaleY: 1.02, translateZ: 0 },
            filter: { blur: 7, contrast: 78, brightness: 88, saturate: 90 },
            styles: { opacity: 1, backgroundColor: '#121217', borderRadius: 8 },
          }),
          createKeyframePoint({
            offset: 44,
            timingFunction: 'custom-cubic',
            bezier: { x1: 0.16, y1: 1.2, x2: 0.3, y2: 1 },
            properties: {
              transform: { scaleX: 1.14, scaleY: 1.05, translateZ: 40 },
              filter: { blur: 0, contrast: 145, brightness: 124, saturate: 130 },
              styles: { opacity: 1, backgroundColor: '#18181f', borderRadius: 22, borderColor: '#00f5d4' },
            },
          }),
          timed('ease-out', 100, {
            transform: { scaleX: 1, scaleY: 1, translateZ: 0 },
            filter: { blur: 0, contrast: 100, brightness: 100, saturate: 100 },
            styles: { opacity: 1, backgroundColor: '#18181f', borderRadius: 16, borderColor: '#00f5d4' },
          }),
        ],
      }),
  },
  {
    id: 'magnetic-tilt',
    name: 'Magnetic Tilt',
    category: 'material',
    description: 'A specular band tracks across a skewed panel while the surface drifts through perspective.',
    preview: {
      shape: 'card',
      viewportBackground: 'dots',
      showPerspectiveGuide: true,
      stageLightingIntensity: 0.95,
    },
    build: () =>
      createTimeline({
        name: 'Magnetic Tilt',
        durationMs: 2000,
        iterationCount: 'infinite',
        direction: 'alternate',
        fillMode: 'both',
        keyframes: [
          timed('ease-in-out', 0, {
            transform: { skewX: -14, rotateX: 9, rotateY: -18, translateX: -26, translateZ: -48 },
            filter: { brightness: 72, contrast: 125, saturate: 55 },
            styles: { backgroundColor: '#0b1120', borderRadius: 22 },
          }),
          timed('ease-in-out', 32, {
            transform: { skewX: 0, rotateX: 0, rotateY: 0, translateX: 0, translateZ: 22 },
            filter: { brightness: 148, contrast: 104, saturate: 135 },
            styles: { backgroundColor: '#1e1b4b', borderRadius: 14 },
          }),
          timed('ease-in-out', 66, {
            transform: { skewX: 9, rotateX: -5, rotateY: 12, translateX: 20, translateZ: 4 },
            filter: { brightness: 112, contrast: 118, saturate: 112 },
            styles: { backgroundColor: '#312e81', borderRadius: 18 },
          }),
          timed('ease-in-out', 100, {
            transform: { skewX: -14, rotateX: 9, rotateY: -18, translateX: -26, translateZ: -48 },
            filter: { brightness: 72, contrast: 125, saturate: 55 },
            styles: { backgroundColor: '#0b1120', borderRadius: 22 },
          }),
        ],
      }),
  },
  {
    id: 'type-staccato',
    name: 'Type Staccato',
    category: 'type',
    description: 'A headline lands in stepped beats, each hit overshooting before the next cut lands.',
    preview: { shape: 'typography', viewportBackground: 'grid-dark', enableMotionTrails: true },
    build: () =>
      createTimeline({
        name: 'Type Staccato',
        durationMs: 1700,
        iterationCount: 'infinite',
        fillMode: 'both',
        keyframes: [
          timed('ease-out', 0, {
            transform: { translateY: 76, skewX: 6, scaleX: 0.95, scaleY: 1.16 },
            filter: { blur: 12, brightness: 88 },
            styles: { opacity: 0, borderWidth: 0, borderRadius: 6 },
          }),
          // Stepped easing holds each beat before cutting to the next, which is
          // what separates a staccato from an ordinary ease.
          timed('step-end', 22, {
            transform: { translateY: -14, skewX: -2, scaleX: 1.06, scaleY: 0.94 },
            filter: { blur: 0, brightness: 122 },
            styles: { opacity: 1, borderWidth: 2, borderRadius: 14 },
          }),
          timed('step-start', 44, {
            transform: { translateY: 10, skewX: 0, scaleX: 0.99, scaleY: 1.04 },
            filter: { blur: 0, brightness: 108 },
            styles: { opacity: 1, borderWidth: 2, borderRadius: 12 },
          }),
          createKeyframePoint({
            offset: 62,
            timingFunction: 'custom-cubic',
            bezier: { x1: 0.22, y1: 1.42, x2: 0.36, y2: 1 },
            properties: {
              transform: { translateY: -6, skewX: 0, scaleX: 1.03, scaleY: 0.98 },
              filter: { blur: 0, brightness: 115 },
              styles: { opacity: 1, borderWidth: 2, borderRadius: 12 },
            },
          }),
          timed('step-end', 80, {
            transform: { translateY: 2, skewX: 0, scaleX: 1, scaleY: 1 },
            filter: { blur: 0, brightness: 100 },
            styles: { opacity: 1, borderWidth: 2, borderRadius: 12 },
          }),
          // The cycle exits fully transparent, so the infinite restart reads as a
          // cut rather than a jump back to the 76px offset.
          timed('ease-in-out', 100, {
            transform: { translateY: -18, skewX: 0, scaleX: 1, scaleY: 0.96 },
            filter: { blur: 2, brightness: 92 },
            styles: { opacity: 0, borderWidth: 2, borderRadius: 12 },
          }),
        ],
      }),
  },
  {
    id: 'rubber-snap',
    name: 'Rubber Snap',
    category: 'motion',
    description: 'A taut release: the element whips across, then rings down through damped overshoots.',
    preview: { shape: 'sphere', viewportBackground: 'grid-dark', stageLightingIntensity: 0.4 },
    build: () =>
      createTimeline({
        name: 'Rubber Snap',
        durationMs: 1300,
        iterationCount: 'infinite',
        direction: 'alternate',
        fillMode: 'both',
        keyframes: [
          // The release curve starts above 1, so the launch accelerates harder
          // than the decay that follows it — that asymmetry is the snap.
          createKeyframePoint({
            offset: 0,
            timingFunction: 'custom-cubic',
            bezier: { x1: 0.72, y1: -0.42, x2: 0.24, y2: 1.4 },
            properties: {
              transform: { translateX: -128, rotateZ: -14, scaleX: 0.68, scaleY: 1.28 },
              filter: { brightness: 92, saturate: 70 },
              styles: { boxShadowBlur: 16, boxShadowSpread: -4 },
            },
          }),
          createKeyframePoint({
            offset: 24,
            timingFunction: 'custom-cubic',
            bezier: { x1: 0.18, y1: 1.5, x2: 0.4, y2: 1 },
            properties: {
              transform: { translateX: 46, rotateZ: 9, scaleX: 1.26, scaleY: 0.78 },
              filter: { brightness: 134, saturate: 150 },
              styles: { boxShadowBlur: 60, boxShadowSpread: -18 },
            },
          }),
          timed('ease-out', 46, {
            transform: { translateX: -18, rotateZ: -5, scaleX: 0.9, scaleY: 1.1 },
            filter: { brightness: 104, saturate: 100 },
            styles: { boxShadowBlur: 32, boxShadowSpread: -9 },
          }),
          timed('ease-out', 64, {
            transform: { translateX: 8, rotateZ: 3, scaleX: 1.08, scaleY: 0.93 },
            filter: { brightness: 112, saturate: 110 },
            styles: { boxShadowBlur: 26, boxShadowSpread: -7 },
          }),
          timed('ease-out', 80, {
            transform: { translateX: -3, rotateZ: -1, scaleX: 0.97, scaleY: 1.03 },
            filter: { brightness: 100, saturate: 100 },
            styles: { boxShadowBlur: 20, boxShadowSpread: -5 },
          }),
          createKeyframePoint({
            offset: 100,
            timingFunction: 'custom-cubic',
            bezier: { x1: 0.72, y1: -0.42, x2: 0.24, y2: 1.4 },
            properties: {
              transform: { translateX: -128, rotateZ: -14, scaleX: 0.68, scaleY: 1.28 },
              filter: { brightness: 92, saturate: 70 },
              styles: { boxShadowBlur: 16, boxShadowSpread: -4 },
            },
          }),
        ],
      }),
  },
  {
    id: 'aurora-wave',
    name: 'Aurora Wave',
    category: 'material',
    description: 'A border glow that drifts through three hues while the panel softly pulses.',
    preview: { shape: 'card', viewportBackground: 'solid-obsidian', stageLightingIntensity: 0.5 },
    build: () =>
      createTimeline({
        name: 'Aurora Wave',
        durationMs: 4200,
        iterationCount: 'infinite',
        direction: 'normal',
        fillMode: 'both',
        keyframes: [
          // 0% and 100% are the same state and the hue sweep ends on a full
          // 360deg turn, so the restart is a continuation rather than a cut.
          timed('ease-in-out', 0, {
            transform: { scaleX: 1, scaleY: 1 },
            filter: { hueRotate: 0, blur: 0, saturate: 120 },
            styles: {
              borderColor: '#22d3ee',
              borderWidth: 2,
              boxShadowBlur: 42,
              boxShadowSpread: -6,
              boxShadowColor: 'rgba(34, 211, 238, 0.55)',
            },
          }),
          timed('ease-in-out', 25, {
            transform: { scaleX: 1.01, scaleY: 1.01 },
            filter: { hueRotate: 90, blur: 1.5, saturate: 135 },
            styles: {
              borderColor: '#a855f7',
              borderWidth: 2,
              boxShadowBlur: 66,
              boxShadowSpread: -10,
              boxShadowColor: 'rgba(168, 85, 247, 0.6)',
            },
          }),
          timed('ease-in-out', 50, {
            transform: { scaleX: 1, scaleY: 1 },
            filter: { hueRotate: 180, blur: 0, saturate: 150 },
            styles: {
              borderColor: '#f472b6',
              borderWidth: 3,
              boxShadowBlur: 88,
              boxShadowSpread: -14,
              boxShadowColor: 'rgba(244, 114, 182, 0.62)',
            },
          }),
          timed('ease-in-out', 75, {
            transform: { scaleX: 0.99, scaleY: 0.99 },
            filter: { hueRotate: 270, blur: 1.5, saturate: 135 },
            styles: {
              borderColor: '#5eead4',
              borderWidth: 2,
              boxShadowBlur: 66,
              boxShadowSpread: -10,
              boxShadowColor: 'rgba(94, 234, 212, 0.6)',
            },
          }),
          timed('ease-in-out', 100, {
            transform: { scaleX: 1, scaleY: 1 },
            filter: { hueRotate: 360, blur: 0, saturate: 120 },
            styles: {
              borderColor: '#22d3ee',
              borderWidth: 2,
              boxShadowBlur: 42,
              boxShadowSpread: -6,
              boxShadowColor: 'rgba(34, 211, 238, 0.55)',
            },
          }),
        ],
      }),
  },
  {
    id: 'cyber-flicker',
    name: 'Cyber Flicker',
    category: 'attention',
    description: 'A high-voltage badge that snaps between brightness plateaus and jolts sideways.',
    preview: {
      shape: 'badge',
      viewportBackground: 'solid-obsidian',
      stageLightingIntensity: 0.2,
      enableMotionTrails: false,
    },
    build: () =>
      createTimeline({
        name: 'Cyber Flicker',
        durationMs: 1400,
        iterationCount: 'infinite',
        direction: 'normal',
        fillMode: 'both',
        keyframes: [
          // `step-start` holds each plateau for the whole segment and cuts
          // instantly at its boundary, which is what makes this read as a
          // failing tube rather than a pulsing one. The two eased frames are the
          // only places the motion is allowed to be smooth.
          timed('ease-out', 0, {
            transform: { translateX: 0, scaleX: 1, scaleY: 1 },
            filter: { brightness: 100, contrast: 100 },
            styles: { borderColor: '#00f5d4', borderWidth: 2, boxShadowBlur: 24, boxShadowColor: 'rgba(0, 245, 212, 0.35)' },
          }),
          timed('step-start', 5, {
            transform: { translateX: 3, scaleX: 1.02, scaleY: 0.98 },
            filter: { brightness: 196, contrast: 148 },
            styles: { borderColor: '#ecfeff', borderWidth: 3, boxShadowBlur: 54, boxShadowColor: 'rgba(236, 254, 255, 0.7)' },
          }),
          timed('step-start', 9, {
            transform: { translateX: -2, scaleX: 1, scaleY: 1 },
            filter: { brightness: 72, contrast: 86 },
            styles: { borderColor: '#164e63', borderWidth: 2, boxShadowBlur: 8, boxShadowColor: 'rgba(0, 245, 212, 0.12)' },
          }),
          timed('step-start', 13, {
            transform: { translateX: 2, scaleX: 1.03, scaleY: 0.97 },
            filter: { brightness: 232, contrast: 170 },
            styles: { borderColor: '#00f5d4', borderWidth: 4, boxShadowBlur: 72, boxShadowColor: 'rgba(0, 245, 212, 0.8)' },
          }),
          timed('step-start', 18, {
            transform: { translateX: -3, scaleX: 0.99, scaleY: 1.01 },
            filter: { brightness: 88, contrast: 104 },
            styles: { borderColor: '#0f766e', borderWidth: 2, boxShadowBlur: 14, boxShadowColor: 'rgba(0, 245, 212, 0.2)' },
          }),
          timed('step-start', 24, {
            transform: { translateX: 1, scaleX: 1.01, scaleY: 1.01 },
            filter: { brightness: 168, contrast: 132 },
            styles: { borderColor: '#5eead4', borderWidth: 3, boxShadowBlur: 58, boxShadowColor: 'rgba(94, 234, 212, 0.62)' },
          }),
          timed('step-start', 31, {
            transform: { translateX: -1, scaleX: 1, scaleY: 1 },
            filter: { brightness: 64, contrast: 78 },
            styles: { borderColor: '#083344', borderWidth: 2, boxShadowBlur: 6, boxShadowColor: 'rgba(0, 245, 212, 0.1)' },
          }),
          // A short recovery ramp: the badge climbs back to its idle level and
          // holds there for the tail of the cycle.
          timed('ease-in-out', 42, {
            transform: { translateX: 0, scaleX: 1, scaleY: 1 },
            filter: { brightness: 108, contrast: 106 },
            styles: { borderColor: '#00f5d4', borderWidth: 2, boxShadowBlur: 30, boxShadowColor: 'rgba(0, 245, 212, 0.4)' },
          }),
          timed('ease-in-out', 68, {
            transform: { translateX: 0, scaleX: 1, scaleY: 1 },
            filter: { brightness: 124, contrast: 112 },
            styles: { borderColor: '#5eead4', borderWidth: 2, boxShadowBlur: 38, boxShadowColor: 'rgba(94, 234, 212, 0.46)' },
          }),
          timed('ease-out', 100, {
            transform: { translateX: 0, scaleX: 1, scaleY: 1 },
            filter: { brightness: 100, contrast: 100 },
            styles: { borderColor: '#00f5d4', borderWidth: 2, boxShadowBlur: 24, boxShadowColor: 'rgba(0, 245, 212, 0.35)' },
          }),
        ],
      }),
  },
  {
    id: 'card-hover-3d',
    name: 'Card Hover 3D',
    category: 'motion',
    description: 'A card pitches back in isometric perspective and casts a deep, widening shadow.',
    preview: {
      shape: 'card',
      viewportBackground: 'grid-dark',
      showPerspectiveGuide: true,
      stageLightingIntensity: 0.65,
    },
    build: () =>
      createTimeline({
        name: 'Card Hover 3D',
        durationMs: 1100,
        fillMode: 'both',
        keyframes: [
          // The lift lands at 55% rather than 100% so the peak pose is held for
          // a beat: an instantaneous return reads as a bounce, not a hover.
          timed('ease-out', 0, {
            transform: { rotateX: 0, rotateY: 0, translateY: 0, scaleX: 1, scaleY: 1 },
            styles: { boxShadowX: 0, boxShadowY: 6, boxShadowBlur: 18, boxShadowSpread: 0, boxShadowColor: 'rgba(0, 0, 0, 0.55)' },
          }),
          timed('ease-out', 55, {
            transform: { rotateX: -18, rotateY: 24, translateY: -28, scaleX: 1.04, scaleY: 1.04 },
            styles: { boxShadowX: 14, boxShadowY: 48, boxShadowBlur: 90, boxShadowSpread: -20, boxShadowColor: 'rgba(0, 0, 0, 0.72)' },
          }),
          // The return eases out too, but from a deeper shadow: the card is
          // still settling when the animation hands back control.
          timed('ease-in-out', 100, {
            transform: { rotateX: 0, rotateY: 0, translateY: 0, scaleX: 1, scaleY: 1 },
            styles: { boxShadowX: 0, boxShadowY: 10, boxShadowBlur: 32, boxShadowSpread: -6, boxShadowColor: 'rgba(0, 0, 0, 0.6)' },
          }),
        ],
      }),
  },
  {
    id: 'morph-squash',
    name: 'Morph Squash',
    category: 'motion',
    description: 'An organic bounce where every compression is paid back as a vertical stretch.',
    preview: { shape: 'sphere', viewportBackground: 'grid-dark', stageLightingIntensity: 0.6 },
    build: () =>
      createTimeline({
        name: 'Morph Squash',
        durationMs: 1500,
        iterationCount: 'infinite',
        direction: 'alternate',
        fillMode: 'both',
        keyframes: [
          // The two scales are reciprocal: volume is traded between the axes
          // rather than added, which is what separates a squash from a scale.
          timed('ease-out', 0, {
            transform: { translateY: 0, scaleX: 1, scaleY: 1 },
            styles: { boxShadowBlur: 40, boxShadowSpread: -10 },
          }),
          timed('ease-out', 22, {
            transform: { translateY: 36, scaleX: 1.2, scaleY: 0.78 },
            filter: { brightness: 104 },
            styles: { boxShadowBlur: 16, boxShadowSpread: -4 },
          }),
          timed('ease-in-out', 48, {
            transform: { translateY: -46, scaleX: 0.88, scaleY: 1.16 },
            filter: { brightness: 118 },
            styles: { boxShadowBlur: 64, boxShadowSpread: -16 },
          }),
          timed('ease-in-out', 74, {
            transform: { translateY: 14, scaleX: 1.06, scaleY: 0.94 },
            filter: { brightness: 96 },
            styles: { boxShadowBlur: 28, boxShadowSpread: -7 },
          }),
          // Closes on the opening pose so `alternate` reverses cleanly.
          timed('ease-in-out', 100, {
            transform: { translateY: 0, scaleX: 1, scaleY: 1 },
            filter: { brightness: 100 },
            styles: { boxShadowBlur: 40, boxShadowSpread: -10 },
          }),
        ],
      }),
  },
  {
    id: 'orbit-spin',
    name: 'Orbit Spin',
    category: 'motion',
    description: 'A body on a tilted orbit, travelling in Z so the turn reads as depth, not a flat spin.',
    preview: {
      shape: 'sphere',
      viewportBackground: 'grid-dark',
      showAxes: true,
      showPerspectiveGuide: true,
      stageLightingIntensity: 0.8,
    },
    build: () =>
      createTimeline({
        name: 'Orbit Spin',
        durationMs: 3000,
        iterationCount: 'infinite',
        direction: 'normal',
        fillMode: 'both',
        keyframes: [
          // Four quarter turns. Each quarter crosses Z and pairs it with a
          // matching scale, so the apparent size change is caused by the travel
          // rather than animated alongside it.
          timed('linear', 0, {
            transform: { rotateY: 0, rotateX: 0, translateZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
            filter: { brightness: 100 },
            styles: { boxShadowBlur: 44, boxShadowSpread: -12 },
          }),
          timed('linear', 25, {
            transform: { rotateY: 90, rotateX: -28, translateZ: 120, scaleX: 1.14, scaleY: 1.14, scaleZ: 1.14 },
            filter: { brightness: 128 },
            styles: { boxShadowBlur: 72, boxShadowSpread: -22 },
          }),
          timed('linear', 50, {
            transform: { rotateY: 180, rotateX: 0, translateZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
            filter: { brightness: 100 },
            styles: { boxShadowBlur: 44, boxShadowSpread: -12 },
          }),
          timed('linear', 75, {
            transform: { rotateY: 270, rotateX: 28, translateZ: -120, scaleX: 0.86, scaleY: 0.86, scaleZ: 0.86 },
            filter: { brightness: 78 },
            styles: { boxShadowBlur: 20, boxShadowSpread: -4 },
          }),
          timed('linear', 100, {
            transform: { rotateY: 360, rotateX: 0, translateZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
            filter: { brightness: 100 },
            styles: { boxShadowBlur: 44, boxShadowSpread: -12 },
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
