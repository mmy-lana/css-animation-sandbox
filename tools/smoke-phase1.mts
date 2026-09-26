import assert from 'node:assert/strict';

import {
  createProjectRecord,
  createTimeline,
  createKeyframePoint,
  moveKeyframeOffset,
  insertKeyframe,
  removeKeyframe,
  removeTimeline,
  validateProjectInvariants,
  updateKeyframe,
  patchKeyframeProperties,
  type AnimationTimeline,
} from '@/types/sandbox';
import { solveCubicBezierTimeForX, pointOnCubicBezier, detectTimingPreset, validateCubicBezier, buildCubicBezierPathD } from '@/lib/bezier';
import {
  generateVanillaCSSKeyframes,
  generateAnimationShorthand,
  generateVanillaStylesheet,
  composeTransformCSS,
  composeFilterCSS,
  computeScrubPercentage,
  resolveSegmentAtOffset,
  generateWebAnimationsApiCode,
  formatTiming,
  normalizeCssIdentifier,
} from '@/lib/cssGenerator';
import { generateTailwindV4CSS } from '@/lib/tailwindFormatter';
import { normalizeProjectRecord, migrateStoragePayload, loadActiveProject, saveActiveProject, clearActiveProject } from '@/lib/storage';
import { sanitizeSvgMarkup, describeSanitizeResult } from '@/lib/sanitizer';

// --- domain model ----------------------------------------------------------
let timeline: AnimationTimeline = createTimeline({ name: 'Demo', durationMs: 1200, iterationCount: 'infinite' });
let project = createProjectRecord({ timelines: [timeline] });
assert.deepEqual(validateProjectInvariants(project), []);

const inserted = insertKeyframe(project, timeline.id, createKeyframePoint({ offset: 50 }));
assert.equal(inserted.ok, true);
project = inserted.value;
assert.equal(project.timelines[0].keyframes.length, 3);

const collision = insertKeyframe(project, timeline.id, createKeyframePoint({ offset: 50 }));
assert.equal(collision.ok, false);
assert.equal(collision.errors[0].field, 'offset');

const moved = moveKeyframeOffset(project, timeline.id, project.timelines[0].keyframes[1].id, 12.345);
assert.equal(moved.ok, true);
assert.equal(moved.resolvedOffset, 12.35);
assert.equal(moved.relocated, false);

const pinned = moveKeyframeOffset(project, timeline.id, project.timelines[0].keyframes[0].id, 42);
assert.equal(pinned.resolvedOffset, 0, '0% endpoint stays pinned');

const endpointRemoval = removeKeyframe(project, timeline.id, project.timelines[0].keyframes[0].id);
assert.equal(endpointRemoval.ok, false);

const patched = patchKeyframeProperties(project, timeline.id, project.timelines[0].keyframes[1].id, {
  transform: { rotateY: 180 },
  styles: { borderRadius: 4 },
});
assert.equal(patched.ok, true);
assert.equal(patched.value.timelines[0].keyframes[1].properties.transform.rotateY, 180);

const badValue = updateKeyframe(project, timeline.id, project.timelines[0].keyframes[1].id, (kf) => ({
  ...kf,
  properties: { ...kf.properties, filter: { ...kf.properties.filter, blur: -5 } },
}));
assert.equal(badValue.ok, false, 'negative blur is rejected');

const onlyTimeline = removeTimeline(project, timeline.id);
assert.equal(onlyTimeline.ok, false, 'last timeline cannot be removed');

// --- bezier ----------------------------------------------------------------
const easeInOut = { x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
assert.equal(Math.round(solveCubicBezierTimeForX(0, easeInOut) * 1e6) / 1e6, 0);
assert.equal(solveCubicBezierTimeForX(1, easeInOut), 1);
assert.ok(Math.abs(pointOnCubicBezier(0.5, easeInOut).y - 0.5) < 1e-6, 'symmetric curve is 0.5 at x=0.5');
const overshoot = { x1: 0, y1: 1.6, x2: 1, y2: 1 };
assert.ok(pointOnCubicBezier(0.5, overshoot).y > 0.7, 'overshoot curve exceeds 0.5');
assert.equal(detectTimingPreset(easeInOut), 'ease-in-out');
assert.equal(detectTimingPreset({ x1: 0.3, y1: 0.2, x2: 0.4, y2: 0.9 }), 'custom-cubic');
assert.deepEqual(validateCubicBezier({ x1: 1.4, y1: 0, x2: 0.2, y2: 1 }).map((e) => e.field), ['x1']);
assert.match(buildCubicBezierPathD(easeInOut, { width: 200, height: 200, padding: 16 }), /^M 16 184 C /);

// --- css generation --------------------------------------------------------
const exportTimeline: AnimationTimeline = {
  ...timeline,
  keyframes: [
    createKeyframePoint({ id: 'a', offset: 0, timingFunction: 'custom-cubic', properties: { transform: { translateX: 120, translateY: -40, translateZ: 30, scaleZ: 1.2, rotateY: 45 } } }),
    createKeyframePoint({ id: 'b', offset: 100, properties: { filter: { blur: 12, saturate: 40 }, styles: { backgroundColor: '#7928ca', boxShadowInset: true, boxShadowSpread: -4 } } }),
  ],
};

const keyframesCss = generateVanillaCSSKeyframes(exportTimeline, 'demo');
assert.match(keyframesCss, /^@keyframes demo \{/);
assert.match(keyframesCss, /transform: translate3d\(120px, -40px, 30px\) rotateY\(45deg\) scale3d\(1, 1, 1\.2\);/);
assert.match(keyframesCss, /animation-timing-function: cubic-bezier\(0\.42, 0\.00, 0\.58, 1\.00\);/);
assert.equal(keyframesCss.match(/animation-timing-function/g)?.length, 1, 'terminal keyframe omits easing');
assert.match(keyframesCss, /box-shadow: inset 0px 18px 48px -4px rgba\(0, 245, 212, 0\.45\);/);
assert.match(keyframesCss, /  100% \{[\s\S]*\}$/);
assert.equal(generateAnimationShorthand(exportTimeline, 'demo'), 'demo 1.20s linear 0s infinite normal both');
assert.equal(composeTransformCSS(exportTimeline.keyframes[1].properties.transform), 'none');
assert.equal(composeFilterCSS(exportTimeline.keyframes[0].properties.filter), 'none');
assert.equal(formatTiming('ease-in-out', easeInOut), 'ease-in-out');

const sheet = generateVanillaStylesheet(exportTimeline, {
  animationClassName: 'My Animation!',
  keyframeRuleName: 'My Animation!',
  includeVendorPrefixes: true,
  includeVariables: true,
  prettify: true,
});
assert.match(sheet, /@-webkit-keyframes my-animation \{/);
assert.match(sheet, /\.my-animation \{/);
assert.equal(normalizeCssIdentifier('My Animation!', 'fallback'), 'my-animation');

const tw = generateTailwindV4CSS(exportTimeline, 'demo');
assert.match(tw, /@theme \{\n {2}--animate-demo: demo 1\.20s linear infinite normal both;\n\}/);
assert.match(tw, /Usage: <div class="animate-demo">/);

const waapi = generateWebAnimationsApiCode(exportTimeline, { animationClassName: 'demo', keyframeRuleName: 'demo', prettify: true });
assert.match(waapi, /const demoKeyframes: Keyframe\[\] = \[/);
assert.match(waapi, /iterations: Infinity/);

// --- scrub geometry --------------------------------------------------------
const rect = { left: 100, width: 400, top: 0, height: 40, right: 500, bottom: 40, x: 100, y: 0, toJSON: () => ({}) } as DOMRect;
assert.equal(computeScrubPercentage(300, rect), 50);
assert.equal(computeScrubPercentage(-500, rect), 0);
assert.equal(computeScrubPercentage(9999, rect), 100);
assert.equal(computeScrubPercentage(300, { ...rect, width: 0 } as DOMRect), 0);
const segment = resolveSegmentAtOffset(exportTimeline, 55);
assert.equal(segment?.from.id, 'a');
assert.ok(Math.abs((segment?.localProgress ?? 0) - 0.55) < 1e-9);

// --- storage + migration ---------------------------------------------------
const legacy = {
  id: 'legacy-1',
  name: 'Legacy',
  activeTimelineId: 'tl-legacy',
  timelines: [
    {
      id: 'tl-legacy',
      name: 'Old',
      durationMs: 800,
      keyframes: [
        { id: 'k1', offset: 100, properties: {} },
        { id: 'k2', offset: 0, properties: { styles: { borderRadius: 'nope' } } },
        { id: 'k3', offset: 0, properties: {} },
      ],
    },
  ],
};
const outcome = migrateStoragePayload(legacy);
assert.equal(outcome.fromVersion, 0);
assert.ok(outcome.migrations.includes('wrap-legacy-project-in-envelope'));
const migrated = outcome.envelope?.project;
assert.ok(migrated, 'legacy payload is repaired, not discarded');
assert.deepEqual(migrated.timelines[0].keyframes.map((k) => k.offset), [0, 100]);
assert.equal(migrated.timelines[0].keyframes[0].properties.styles.borderRadius, 16);
assert.equal(migrated.timelines[0].fillMode, 'both');
assert.equal(migrated.preview.viewportBackground, 'grid-dark');
assert.deepEqual(validateProjectInvariants(migrated), []);

assert.equal(normalizeProjectRecord({ timelines: [] }), null);
assert.equal(normalizeProjectRecord(null), null);

clearActiveProject();
assert.deepEqual(loadActiveProject(), { status: 'empty' });
const write = saveActiveProject(migrated);
assert.equal(write.status, 'ok');
const loaded = loadActiveProject();
assert.equal(loaded.status, 'ok');
assert.equal(loaded.status === 'ok' ? loaded.envelope.project.name : '', 'Legacy');
clearActiveProject();

// --- sanitizer (server environment must fail closed) ------------------------
const sanitized = sanitizeSvgMarkup('<svg viewBox="0 0 10 10"><script>alert(1)</script><rect/></svg>');
assert.equal(sanitized.markup, '', 'no DOM available on the server => fails closed');
assert.equal(sanitized.reason, 'unsupported-environment');
assert.match(describeSanitizeResult(sanitized), /Sanitizer unavailable/);
assert.equal(sanitizeSvgMarkup('<div>no svg</div>').reason, 'non-svg-root');
assert.equal(sanitizeSvgMarkup('   ').reason, 'empty-input');

console.log('phase-1 smoke: all assertions passed');
