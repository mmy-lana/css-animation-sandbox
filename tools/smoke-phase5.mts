/**
 * Phase 5 smoke suite: the interpolation that drives the paused preview, the
 * preset catalogue, and the export output the drawer and code viewer render.
 *
 * Runs under plain Node (no DOM), so it covers the pure decision logic the
 * studio shell composes. Assertions are behaviour, not implementation details.
 */

import assert from 'node:assert/strict';
import {
  formatMillisecondsAsSeconds,
  interpolateKeyframeProperties,
  generateVanillaStylesheet,
  generateWebAnimationsApiCode,
  resolveSegmentAtOffset,
  toWaapiIterations,
} from '@/lib/cssGenerator';
import { generateTailwindV4Stylesheet } from '@/lib/tailwindFormatter';
import { ANIMATION_PRESETS, PRESET_CATEGORY_LABELS, groupPresetsByCategory, resolveUniqueTimelineName } from '@/lib/presets';
import { hasSvgRoot, isSanitizerSupported } from '@/lib/sanitizer';
import {
  DEFAULT_EXPORT_OPTIONS,
  EXPORT_TARGETS,
  addTimeline,
  createKeyframePoint,
  createProjectRecord,
  createTimeline,
  findKeyframe,
  findTimeline,
  insertKeyframe,
  moveKeyframeOffset,
  updateTimeline,
  validateExportOptions,
  validateKeyframePoint,
  validateProjectInvariants,
  validateTimelineTiming,
  type AnimationTimeline,
  type ExportOptions,
  type KeyframePoint,
} from '@/types/sandbox';

let checks = 0;
function check(label: string, fn: () => void): void {
  fn();
  checks += 1;
  process.stdout.write(`  ✓ ${label}\n`);
}

const round = (value: number, digits = 4): number => Number(value.toFixed(digits));

function keyframe(overrides: Partial<Parameters<typeof createKeyframePoint>[0]> = {}): KeyframePoint {
  return createKeyframePoint({
    offset: 0,
    ...overrides,
  });
}

// --- Paused-preview interpolation ------------------------------------------

const fromPoint = keyframe({
  offset: 0,
  properties: {
    transform: { translateX: 0, translateY: 100, rotateZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
    filter: { blur: 0, opacity: 1, brightness: 1 },
    styles: {
      opacity: 0,
      backgroundColor: '#00000000',
      borderRadius: 0,
      boxShadowBlur: 0,
      boxShadowInset: false,
    },
  },
});

const toPoint = keyframe({
  offset: 100,
  properties: {
    transform: { translateX: 40, translateY: 0, rotateZ: 45, scaleX: 2, scaleY: 2, scaleZ: 1 },
    filter: { blur: 12, opacity: 0.5, brightness: 1.4 },
    styles: {
      opacity: 1,
      backgroundColor: '#00f5d4',
      borderRadius: 24,
      boxShadowBlur: 40,
      boxShadowInset: true,
    },
  },
});

check('interpolation reproduces the source keyframes exactly at both ends', () => {
  assert.deepEqual(interpolateKeyframeProperties(fromPoint, toPoint, 0).transform, fromPoint.properties.transform);
  assert.deepEqual(interpolateKeyframeProperties(fromPoint, toPoint, 0).styles, fromPoint.properties.styles);
  assert.deepEqual(interpolateKeyframeProperties(fromPoint, toPoint, 1).transform, toPoint.properties.transform);
  assert.deepEqual(interpolateKeyframeProperties(fromPoint, toPoint, 1).filter, toPoint.properties.filter);
  assert.deepEqual(interpolateKeyframeProperties(fromPoint, toPoint, 1).styles, toPoint.properties.styles);
});

check('numeric properties lerp linearly and discrete values switch at the midpoint', () => {
  const halfway = interpolateKeyframeProperties(fromPoint, toPoint, 0.5);
  assert.equal(halfway.transform.translateY, 50);
  assert.equal(halfway.transform.rotateZ, 22.5);
  assert.equal(halfway.filter.blur, 6);
  assert.equal(halfway.styles.opacity, 0.5);
  assert.equal(halfway.styles.borderRadius, 12);
  // Colors and booleans cannot blend, so they adopt the nearer keyframe.
  assert.equal(halfway.styles.backgroundColor, toPoint.properties.styles.backgroundColor);
  assert.equal(halfway.styles.boxShadowInset, true);
  assert.equal(interpolateKeyframeProperties(fromPoint, toPoint, 0.25).styles.boxShadowInset, false);
  assert.equal(interpolateKeyframeProperties(fromPoint, toPoint, 0.25).styles.backgroundColor, fromPoint.properties.styles.backgroundColor);
  assert.equal(interpolateKeyframeProperties(fromPoint, toPoint, 0.5).styles.opacity, 0.5);
  assert.equal(round(interpolateKeyframeProperties(fromPoint, toPoint, 0.5).filter.opacity), 0.75);
});

check('progress outside 0…1 and non-numeric input clamps instead of extrapolating', () => {
  assert.deepEqual(interpolateKeyframeProperties(fromPoint, toPoint, -5).transform, fromPoint.properties.transform);
  assert.deepEqual(interpolateKeyframeProperties(fromPoint, toPoint, 42).transform, toPoint.properties.transform);
  assert.deepEqual(interpolateKeyframeProperties(fromPoint, toPoint, Number.NaN).transform, fromPoint.properties.transform);
});

check('interpolation stays monotonic across the whole segment', () => {
  // translateY travels 100 → 0, so a monotonic descent is the expected shape.
  let previous = Number.POSITIVE_INFINITY;
  for (let step = 0; step <= 20; step += 1) {
    const value = interpolateKeyframeProperties(fromPoint, toPoint, step / 20).transform.translateY;
    assert.ok(value <= previous, `translateY rose at ${step / 20}`);
    previous = value;
  }
  assert.equal(round(previous), 0);
});

// --- Segment resolution for the playhead ------------------------------------

const segmentTimeline = createTimeline({
  name: 'Segments',
  durationMs: 1000,
  keyframes: [
    keyframe({ offset: 0 }),
    keyframe({ offset: 40, properties: { transform: { translateX: 40 } } }),
    keyframe({ offset: 100, properties: { transform: { translateX: 100 } } }),
  ],
});

check('resolveSegmentAtOffset picks the outgoing segment and its local progress', () => {
  // At an endpoint the pair collapses onto that keyframe, so callers can read
  // `from.id === to.id` as "the playhead is resting on a keyframe".
  const start = resolveSegmentAtOffset(segmentTimeline, 0);
  assert.equal(start?.from.offset, 0);
  assert.equal(start?.to.offset, 0);
  assert.equal(start?.localProgress, 0);

  const first = resolveSegmentAtOffset(segmentTimeline, 20);
  assert.equal(first?.from.offset, 0);
  assert.equal(first?.to.offset, 40);
  assert.equal(first?.localProgress, 0.5);

  const middle = resolveSegmentAtOffset(segmentTimeline, 60);
  assert.equal(middle?.from.offset, 40);
  assert.equal(middle?.to.offset, 100);
  assert.equal(round(middle?.localProgress ?? -1), round(1 / 3));

  const end = resolveSegmentAtOffset(segmentTimeline, 100);
  assert.equal(end?.from.offset, 100);
  assert.equal(end?.to.offset, 100);
  assert.equal(end?.localProgress, 1);
  // An empty timeline has nothing to resolve; a single keyframe degenerates.
  assert.equal(resolveSegmentAtOffset({ ...createTimeline({ name: 'Empty' }), keyframes: [] }, 50), null);
  const solo = keyframe({ offset: 30 });
  const soloSegment = resolveSegmentAtOffset({ ...createTimeline({ name: 'Solo' }), keyframes: [solo] }, 50);
  assert.equal(soloSegment?.from.id, solo.id);
  assert.equal(soloSegment?.to.id, solo.id);
  assert.equal(soloSegment?.localProgress, 0);
});

// --- Preset catalogue -------------------------------------------------------

check('every preset builds a valid, animatable timeline', () => {
  assert.ok(ANIMATION_PRESETS.length >= 8, 'expected at least eight presets');
  for (const preset of ANIMATION_PRESETS) {
    const timeline = preset.build();
    assert.ok(timeline.keyframes.length >= 2, `${preset.id} needs at least two keyframes`);
    assert.deepEqual(validateTimelineTiming(timeline), [], `${preset.id} produced invalid timing`);
    assert.equal(timeline.keyframes[0].offset, 0, `${preset.id} must start at 0%`);
    assert.equal(timeline.keyframes[timeline.keyframes.length - 1].offset, 100, `${preset.id} must end at 100%`);
    for (const point of timeline.keyframes) {
      assert.deepEqual(
        validateKeyframePoint(point, timeline.keyframes.map(({ id, offset }) => ({ id, offset }))),
        [],
        `${preset.id} has an invalid keyframe`,
      );
    }
    const ids = new Set(timeline.keyframes.map((point) => point.id));
    assert.equal(ids.size, timeline.keyframes.length, `${preset.id} reuses a keyframe id`);
  }
});

check('preset ids and names are unique', () => {
  assert.equal(new Set(ANIMATION_PRESETS.map((preset) => preset.id)).size, ANIMATION_PRESETS.length);
  assert.equal(new Set(ANIMATION_PRESETS.map((preset) => preset.name)).size, ANIMATION_PRESETS.length);
  for (const preset of ANIMATION_PRESETS) {
    assert.ok(preset.description.length > 0, `${preset.id} needs a description`);
    assert.ok(preset.category in PRESET_CATEGORY_LABELS, `${preset.id} has an unknown category`);
  }
});

check('groupPresetsByCategory keeps every preset exactly once with catalog order', () => {
  const groups = groupPresetsByCategory();
  const flattened = groups.flatMap((group) => group.presets);
  // Grouping reorders the catalogue by first-seen category, so the invariant is
  // "no preset is lost and each group keeps its catalog order".
  assert.equal(flattened.length, ANIMATION_PRESETS.length);
  assert.deepEqual(
    flattened.map((preset) => preset.id).sort(),
    ANIMATION_PRESETS.map((preset) => preset.id).sort(),
  );
  for (const group of groups) {
    assert.equal(group.label, PRESET_CATEGORY_LABELS[group.category]);
    assert.ok(group.presets.every((preset) => preset.category === group.category));
    const expectedOrder = ANIMATION_PRESETS.filter((preset) => preset.category === group.category);
    assert.deepEqual(group.presets, expectedOrder);
  }
  // Categories appear in first-seen order, and no empty buckets are emitted.
  const categories = groups.map((group) => group.category);
  assert.deepEqual(categories, [...new Set(categories)]);
  assert.ok(groups.every((group) => group.presets.length > 0));
  // An empty input yields no groups rather than a placeholder bucket.
  assert.deepEqual(groupPresetsByCategory([]), []);
});

check('applying a preset keeps the project valid in both replace and append mode', () => {
  const project = createProjectRecord({ name: 'Host' });
  const preset = ANIMATION_PRESETS[0];
  assert.deepEqual(validateProjectInvariants(project), []);

  const appended = addTimeline(project, preset.build());
  assert.equal(appended.ok, true);
  if (appended.ok) {
    assert.equal(appended.value.timelines.length, 2);
    assert.equal(appended.value.timelines[1].name, preset.build().name);
    assert.deepEqual(validateProjectInvariants(appended.value), []);
  }

  const replaced = updateTimeline(project, project.timelines[0].id, () => ({
    ...preset.build(),
    id: project.timelines[0].id,
  }));
  assert.equal(replaced.ok, true);
  if (replaced.ok) {
    assert.equal(replaced.value.timelines.length, 1);
    assert.deepEqual(validateProjectInvariants(replaced.value), []);
  }

  // Swapping the identity is rejected: it would dangle the active pointer.
  const identitySwap = updateTimeline(project, project.timelines[0].id, () => preset.build());
  assert.equal(identitySwap.ok, false);
  if (!identitySwap.ok) assert.equal(identitySwap.value, null);
});

check('resolveUniqueTimelineName disambiguates collisions with the smallest free suffix', () => {
  assert.equal(resolveUniqueTimelineName('Elastic Pop', []), 'Elastic Pop');
  assert.equal(resolveUniqueTimelineName('Elastic Pop', ['Other']), 'Elastic Pop');
  assert.equal(resolveUniqueTimelineName('Elastic Pop', ['Elastic Pop']), 'Elastic Pop 2');
  // Suffixes already taken are skipped, and matching ignores case and padding.
  assert.equal(resolveUniqueTimelineName('Elastic Pop', ['Elastic Pop', 'Elastic Pop 2']), 'Elastic Pop 3');
  assert.equal(resolveUniqueTimelineName('Elastic Pop', ['  elastic pop  ', 'ELASTIC POP 2']), 'Elastic Pop 3');
  assert.equal(resolveUniqueTimelineName('  Elastic Pop  ', ['Elastic Pop']), 'Elastic Pop 2');
  for (const preset of ANIMATION_PRESETS) {
    const taken = ANIMATION_PRESETS.filter((entry) => entry.id !== preset.id).map((entry) => entry.name);
    const resolved = resolveUniqueTimelineName(preset.name, taken);
    assert.equal(new Set([...taken, resolved].map((entry) => entry.toLowerCase())).size, taken.length + 1);
  }
});

check('appending the same preset twice keeps names and keyframe ids distinct', () => {
  const project = createProjectRecord({ name: 'Host' });
  const preset = ANIMATION_PRESETS[1];
  const first = addTimeline(project, preset.build());
  assert.equal(first.ok, true);
  if (!first.ok) return;

  // The drawer renames before dispatching; the mutator only guarantees ids.
  const second = addTimeline(first.value, {
    ...preset.build(),
    name: resolveUniqueTimelineName(preset.build().name, first.value.timelines.map((entry) => entry.name)),
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.value.timelines.length, 3);
  const names = second.value.timelines.map((entry) => entry.name);
  assert.equal(new Set(names).size, names.length, `names collided: ${names.join(' | ')}`);
  const ids = second.value.timelines.flatMap((entry) => entry.keyframes.map((point) => point.id));
  assert.equal(new Set(ids).size, ids.length, 'keyframes must stay globally unique');
  assert.deepEqual(validateProjectInvariants(second.value), []);
});

// --- Editing the playhead and a preset timeline -----------------------------

check('inserting a keyframe at the playhead inherits the resolved start state', () => {
  const project = createProjectRecord({ name: 'Host' });
  const timeline = preset2Timeline();
  const withTimeline = addTimeline(project, timeline);
  assert.equal(withTimeline.ok, true);
  if (!withTimeline.ok) return;

  const segment = resolveSegmentAtOffset(timeline, 25);
  assert.ok(segment);
  const inserted = insertKeyframe(withTimeline.value, timeline.id, createKeyframePoint({
    offset: 25,
    properties: {
      transform: { ...segment.from.properties.transform },
      filter: { ...segment.from.properties.filter },
      styles: { ...segment.from.properties.styles },
    },
  }));
  assert.equal(inserted.ok, true);
  if (!inserted.ok) return;
  const edited = findTimeline(inserted.value, timeline.id);
  assert.equal(edited?.keyframes.length, timeline.keyframes.length + 1);
  // Keyframes are kept sorted by offset, and sibling timelines are untouched.
  const offsets = edited?.keyframes.map((point) => point.offset) ?? [];
  assert.deepEqual(offsets, [...offsets].sort((a, b) => a - b));
  assert.ok(offsets.includes(25));
  assert.equal(inserted.value.timelines[0].keyframes.length, project.timelines[0].keyframes.length);
  assert.deepEqual(validateProjectInvariants(inserted.value), []);

  // A duplicate offset is rejected and the project is left untouched.
  const duplicate = insertKeyframe(inserted.value, timeline.id, createKeyframePoint({ offset: 25 }));
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.value, null);
});

check('dragging a keyframe offset echoes where it actually landed', () => {
  const project = createProjectRecord({ name: 'Host' });
  const timeline = preset2Timeline();
  const withTimeline = addTimeline(project, timeline);
  assert.equal(withTimeline.ok, true);
  if (!withTimeline.ok) return;
  assert.ok(timeline.keyframes.length >= 3, 'this check needs a timeline with a middle keyframe');

  const id = timeline.keyframes[1].id;

  // A free mid-range value lands exactly, with no relocation.
  const free = moveKeyframeOffset(withTimeline.value, timeline.id, id, 55);
  assert.equal(free.ok, true);
  assert.equal(free.relocated, false);
  assert.equal(free.resolvedOffset, 55);
  assert.equal(findKeyframe(findTimeline(free.value, timeline.id)!, id)?.offset, 55);

  // Beyond the maximum: the clamp target is taken by the pinned 100% endpoint,
  // so the keyframe walks outwards to the nearest free slot below it.
  const clamped = moveKeyframeOffset(withTimeline.value, timeline.id, id, 180);
  assert.equal(clamped.ok, true);
  assert.equal(clamped.relocated, true);
  assert.ok(clamped.resolvedOffset <= 100 && clamped.resolvedOffset > 90, `unexpected slot ${clamped.resolvedOffset}`);
  assert.equal(findKeyframe(findTimeline(clamped.value, timeline.id)!, id)?.offset, clamped.resolvedOffset);
  assert.deepEqual(validateProjectInvariants(clamped.value), []);

  // Onto an occupied offset: the keyframe walks outwards to the nearest free slot.
  const occupiedOffset = timeline.keyframes[2].offset;
  const displaced = moveKeyframeOffset(withTimeline.value, timeline.id, id, occupiedOffset);
  assert.equal(displaced.ok, true);
  assert.equal(displaced.relocated, true);
  assert.notEqual(displaced.resolvedOffset, occupiedOffset);
  assert.equal(findKeyframe(findTimeline(displaced.value, timeline.id)!, id)?.offset, displaced.resolvedOffset);
  const offsets = findTimeline(displaced.value, timeline.id)?.keyframes.map((point) => point.offset) ?? [];
  assert.equal(new Set(offsets).size, offsets.length, 'no two keyframes may share an offset');
  assert.deepEqual(offsets, [...offsets].sort((a, b) => a - b), 'keyframes stay sorted');
  assert.deepEqual(validateProjectInvariants(displaced.value), []);

  // Endpoints are pinned so every timeline keeps a 0% and a 100% pose.
  const endpointId = timeline.keyframes[timeline.keyframes.length - 1].id;
  const endpointOffset = timeline.keyframes[timeline.keyframes.length - 1].offset;
  const pinned = moveKeyframeOffset(withTimeline.value, timeline.id, endpointId, 55);
  assert.equal(pinned.ok, true);
  assert.equal(pinned.relocated, false);
  assert.equal(pinned.resolvedOffset, endpointOffset);
  assert.equal(findKeyframe(findTimeline(pinned.value, timeline.id)!, endpointId)?.offset, endpointOffset);
});

function preset2Timeline(): AnimationTimeline {
  return ANIMATION_PRESETS[1].build();
}

// --- Export output for the drawer and code viewer ---------------------------

const exportTimeline = ANIMATION_PRESETS[0].build();

check('the vanilla stylesheet carries the keyframes and a matching animation', () => {
  const options = DEFAULT_EXPORT_OPTIONS;
  const css = generateVanillaStylesheet(exportTimeline, options);
  assert.ok(css.includes(`@keyframes ${options.keyframeRuleName}`), 'missing keyframes block');
  assert.ok(css.includes(`.${options.animationClassName}`), 'missing animation class');
  // Durations are emitted in seconds, as CSS requires.
  assert.ok(css.includes(`${formatMillisecondsAsSeconds(exportTimeline.durationMs)} linear`), 'missing duration');
  // The final keyframe must not carry an easing declaration.
  const lastBlock = css.slice(css.indexOf('\n  100% {\n'));
  assert.ok(lastBlock.startsWith('\n  100% {\n'), 'missing the 100% keyframe block');
  assert.ok(
    !lastBlock.slice(0, lastBlock.indexOf('\n  }')).includes('animation-timing-function'),
    'the last keyframe must not carry an easing declaration',
  );
  assert.ok(css.includes('animation-timing-function:'), 'earlier keyframes must carry their easing');
  assert.ok(css.includes('translate3d('), 'transforms must be emitted as 3D functions');
  assert.deepEqual(validateExportOptions(options), []);

  // The optional blocks are opt-in and each one changes the output.
  const plain = generateVanillaStylesheet(exportTimeline, { ...options, includeVendorPrefixes: false, includeVariables: false, prettify: false });
  assert.ok(!plain.includes('@-webkit-keyframes'), 'vendor prefix leaked into the plain export');
  assert.ok(!plain.includes(':root'), 'variables leaked into the plain export');
  const rich = generateVanillaStylesheet(exportTimeline, { ...options, includeVendorPrefixes: true, includeVariables: true, prettify: true });
  assert.ok(rich.includes(`@-webkit-keyframes ${options.keyframeRuleName}`), 'missing vendor alias');
  assert.ok(rich.includes('--anim-'), 'missing timeline custom properties');
  assert.notEqual(rich, plain);
});

check('every export target produces non-empty, distinct code', () => {
  const outputs = EXPORT_TARGETS.map((target) => {
    const options: ExportOptions = { ...DEFAULT_EXPORT_OPTIONS, target };
    assert.deepEqual(validateExportOptions(options), [], `${target} options rejected`);
    if (target === 'tailwind-v4') return generateTailwindV4Stylesheet(exportTimeline, options);
    if (target === 'web-animations-api') return generateWebAnimationsApiCode(exportTimeline, options);
    return generateVanillaStylesheet(exportTimeline, options);
  });
  for (const output of outputs) {
    assert.ok(output.trim().length > 40, 'export output looks empty');
  }
  assert.equal(new Set(outputs).size, outputs.length, 'targets produced identical output');
});

check('export options reject unusable identifiers before generation', () => {
  assert.ok(validateExportOptions({ ...DEFAULT_EXPORT_OPTIONS, animationClassName: '9 bad-name' }).length > 0);
  assert.ok(validateExportOptions({ ...DEFAULT_EXPORT_OPTIONS, keyframeRuleName: '' }).length > 0);
  assert.ok(validateExportOptions({ ...DEFAULT_EXPORT_OPTIONS, target: 'scss' as never }).length > 0);
  assert.deepEqual(validateExportOptions({ ...DEFAULT_EXPORT_OPTIONS, animationClassName: 'fade-up' }), []);
});

check('web-animations output is a paste-ready animate() call with the timeline timing', () => {
  const options: ExportOptions = { ...DEFAULT_EXPORT_OPTIONS, target: 'web-animations-api' };
  const code = generateWebAnimationsApiCode(exportTimeline, options);
  assert.ok(code.includes('.animate('), 'missing animate() call');
  assert.ok(code.includes(`duration: ${Math.round(exportTimeline.durationMs)}`), 'missing duration');
  assert.ok(code.includes(`delay: ${Math.round(exportTimeline.delayMs)}`), 'missing delay');
  assert.ok(code.includes(`iterations: ${toWaapiIterations(exportTimeline.iterationCount)}`), 'missing iteration count');
  assert.ok(code.includes(`direction: '${exportTimeline.direction}'`), 'missing direction');
  assert.ok(code.includes(`fill: '${exportTimeline.fillMode}'`), 'missing fill mode');
  // Offsets are 0…1 for the API, not percentages.
  assert.ok(code.includes('offset: 0'), 'missing first frame offset');
  assert.ok(code.includes('offset: 1'), 'missing last frame offset');
  // Balanced brackets mean the snippet can be pasted into a module as-is.
  const opens = (code.match(/[[{(]/g) ?? []).length;
  const closes = (code.match(/[\]})]/g) ?? []).length;
  assert.equal(opens, closes, 'unbalanced brackets in the generated snippet');
  // Every frame is present, and only the last one omits its easing.
  const frameCount = (code.match(/offset: /g) ?? []).length;
  assert.equal(frameCount, exportTimeline.keyframes.length);
  assert.equal((code.match(/easing: '/g) ?? []).length, exportTimeline.keyframes.length - 1);
});

// --- SVG guard for the custom-shape stage -----------------------------------

check('the custom SVG guard recognises roots without sanitizing in Node', () => {
  assert.equal(isSanitizerSupported(), false, 'DOMPurify must be unavailable without a DOM');
  assert.equal(hasSvgRoot("<svg viewBox='0 0 24 24'><path d='M0 0' /></svg>"), true);
  assert.equal(hasSvgRoot("<div><span>not svg</span></div>"), false);
  assert.equal(hasSvgRoot('   '), false);
});

process.stdout.write(`\nPhase 5 smoke: ${checks} checks passed\n`);
