import assert from 'node:assert/strict';

import {
  buildCubicBezierHandleGeometry,
  detectTimingPreset,
  mapPlotToUnit,
  mapUnitToPlot,
  DEFAULT_BEZIER_PLOT_BOX,
  sampleCubicBezier,
} from '@/lib/bezier';
import {
  computeScrubPercentage,
  formatTimecode,
  progressRatioToTime,
  resolveSegmentAtOffset,
  timeToProgressRatio,
} from '@/lib/cssGenerator';
import { describeSanitizeResult, extractSvgViewBox, hasSvgRoot, isSanitizerSupported, sanitizeSvgMarkup } from '@/lib/sanitizer';
import {
  createKeyframePoint,
  createProjectRecord,
  createTimeline,
  moveKeyframeOffset,
  sortKeyframesByOffset,
  type AnimationTimeline,
  type CubicBezierPoints,
} from '@/types/sandbox';

const BOX = DEFAULT_BEZIER_PLOT_BOX;

// --- BezierCurveEditor: handle geometry stays exact in SVG space -----------
// The editor drags a handle in client pixels, converts to the plot box, then
// inverts it back into unit space. A lossless round trip is what keeps the
// drawn control polygon identical to the exported cubic-bezier().
const dragPoints: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
  { x: 0.42, y: 0 },
  { x: 0.58, y: 1 },
  { x: 0.05, y: -0.4 },
  { x: 0.95, y: 2 },
  { x: 0.5, y: 0.5 },
];

for (const point of dragPoints) {
  const roundTrip = mapPlotToUnit(mapUnitToPlot(point, BOX), BOX);
  assert.ok(
    Math.abs(roundTrip.x - point.x) < 1e-9 && Math.abs(roundTrip.y - point.y) < 1e-9,
    `unit → plot → unit must be lossless (${point.x}, ${point.y})`,
  );
}

const bezier: CubicBezierPoints = { x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
const geometry = buildCubicBezierHandleGeometry(bezier, BOX);
const control1 = mapUnitToPlot({ x: bezier.x1, y: bezier.y1 }, BOX);
const control2 = mapUnitToPlot({ x: bezier.x2, y: bezier.y2 }, BOX);
assert.ok(Math.abs(geometry.control1.x - control1.x) < 1e-9, 'P1 circle sits on the mapped unit point');
assert.ok(Math.abs(geometry.control1.y - control1.y) < 1e-9, 'P1 circle sits on the mapped unit point');
assert.ok(Math.abs(geometry.control2.x - control2.x) < 1e-9, 'P2 circle sits on the mapped unit point');
assert.ok(geometry.firstHandlePathD.startsWith('M'), 'first handle is a path');
assert.ok(geometry.secondHandlePathD.startsWith('M'), 'second handle is a path');

const samples = sampleCubicBezier(bezier, 64, { min: -2, max: 2 });
assert.equal(samples.length, 64, 'sampleCubicBezier returns sampleCount points');
assert.ok(Math.abs(samples[0].y - 0) < 1e-6, 'curve starts at y = 0');
assert.ok(Math.abs(samples[samples.length - 1].y - 1) < 1e-6, 'curve ends at y = 1');
assert.ok(
  samples.every((sample) => sample.x >= -1e-9 && sample.x <= 1 + 1e-9),
  'x is monotonically inside the unit square for a valid x1/x2 pair',
);
assert.equal(detectTimingPreset(bezier), 'ease-in-out', 'default curve is recognised as a named preset');
assert.equal(detectTimingPreset({ x1: 0.31, y1: 0.11, x2: 0.77, y2: 0.42 }), 'custom-cubic');

// --- KeyframeNode: drag targets never corrupt the timeline -----------------
let project = createProjectRecord();
let timeline: AnimationTimeline = createTimeline({
  id: 'tl-1',
  keyframes: [
    createKeyframePoint({ id: 'k0', offset: 0 }),
    createKeyframePoint({ id: 'k1', offset: 25 }),
    createKeyframePoint({ id: 'k2', offset: 60 }),
    createKeyframePoint({ id: 'k3', offset: 100 }),
  ],
});
assert.deepEqual(
  timeline.keyframes.map((frame) => frame.offset),
  [0, 25, 60, 100],
  'createTimeline sorts supplied keyframes by offset',
);
assert.equal(
  sortKeyframesByOffset([...timeline.keyframes].reverse()).map((frame) => frame.id).join(','),
  'k0,k1,k2,k3',
  'sortKeyframesByOffset is stable regardless of input order',
);
project = { ...project, timelines: [timeline] };

const drag = (keyframeId: string, offset: number) =>
  moveKeyframeOffset(project, 'tl-1', keyframeId, offset);

const dragged = drag('k2', 40);
assert.equal(dragged.ok, true, 'dragging to a free offset succeeds');
assert.equal(dragged.ok && dragged.value.timelines[0].keyframes[2].offset, 40, 'the committed offset is applied');

const endpoint = drag('k0', 80);
assert.equal(endpoint.resolvedOffset, 0, '0% endpoint stays pinned while dragging');
assert.equal(endpoint.relocated, false, 'a pinned endpoint is not reported as relocated');

const lastEndpoint = drag('k3', 20);
assert.equal(lastEndpoint.resolvedOffset, 100, '100% endpoint stays pinned while dragging');

const collision = drag('k2', 25);
assert.equal(collision.ok, true, 'a colliding drop is resolved, not rejected');
assert.equal(collision.relocated, true, 'collision is reported so the UI can explain the nudge');
assert.notEqual(collision.resolvedOffset, 25, 'a resolved collision never lands on an occupied offset');
const occupiedAfter = new Set(
  collision.ok
    ? collision.value.timelines[0].keyframes.filter((frame) => frame.id !== 'k2').map((frame) => frame.offset)
    : [],
);
assert.ok(occupiedAfter.has(collision.resolvedOffset) === false, 'relocated offset is free');

const outOfRange = drag('k2', 480);
assert.ok(outOfRange.resolvedOffset <= 100, 'dragging past the right edge clamps inside the track');

const nan = drag('k2', Number.NaN);
assert.equal(nan.ok, false, 'a non-finite drag offset is rejected with a field error');

// --- TrackRuler / ScrubBar: client X maps to a clamped percentage ---------
const track = { left: 40, width: 800 } as DOMRect;
assert.equal(computeScrubPercentage(40, track), 0, 'left edge is 0%');
assert.equal(computeScrubPercentage(840, track), 100, 'right edge is 100%');
assert.equal(computeScrubPercentage(240, track), 25, 'a quarter across is 25%');
assert.equal(computeScrubPercentage(-80, track), 0, 'dragging left of the track clamps to 0%');
assert.equal(computeScrubPercentage(9_000, track), 100, 'dragging right of the track clamps to 100%');
assert.equal(computeScrubPercentage(100, { left: 0, width: 0 } as DOMRect), 0, 'a collapsed track never divides by zero');

// --- Segment resolution for the scrub preview ------------------------------
const segment = resolveSegmentAtOffset(dragged.ok ? dragged.value.timelines[0] : timeline, 32.5);
assert.ok(segment !== null, 'a bracketing segment resolves');
assert.equal(segment?.from.id, 'k1', 'segment starts at the 25% keyframe');
assert.equal(segment?.to.id, 'k2', 'segment ends at the dragged keyframe');
assert.ok(Math.abs((segment?.localProgress ?? 0) - 0.5) < 1e-9, 'local progress is linear inside the segment');
assert.equal(resolveSegmentAtOffset(timeline, -40)?.localProgress, 0, 'a negative offset pins to the first keyframe');
assert.equal(resolveSegmentAtOffset(timeline, 400)?.localProgress, 1, 'an offset past the end pins to the last keyframe');

assert.equal(timeToProgressRatio(500, timeline), 0.5, 'half the duration is half the progress');
assert.equal(progressRatioToTime(0.25, timeline), timeline.durationMs / 4, 'progress maps back to a time');
assert.equal(formatTimecode(65_432), '1:05.432', 'timecode is m:ss.mmm');
assert.equal(formatTimecode(-10), '0:00.000', 'negative timecodes clamp to zero');

// --- TargetGeometry: custom SVG contract ----------------------------------
// The smoke harness runs without a DOM, which is exactly the environment the
// stage must fail closed in: markup is never rendered, and the UI receives an
// explicit reason instead of unsanitized content.
const supported = isSanitizerSupported();
const benign = sanitizeSvgMarkup('<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>');
assert.equal(benign.hadSvgRoot, true, 'an <svg> root is detected before purification');
assert.equal(benign.removed.length, 0, 'nothing is stripped when purification never runs');
if (supported) {
  assert.equal(benign.ok, true, 'a plain SVG survives sanitization');
  assert.ok(benign.markup.includes('<circle'), 'the shape body is preserved');
  const hostile = sanitizeSvgMarkup(
    '<svg><script>alert(1)</script><circle onclick="alert(2)" cx="1" cy="1" r="1" /></svg>',
  );
  assert.equal(hostile.ok, true, 'a partially hostile document still renders its safe parts');
  assert.ok(!hostile.markup.includes('<script'), 'script elements are stripped');
  assert.ok(!hostile.markup.includes('onclick'), 'event handler attributes are stripped');
  assert.ok(hostile.removed.length > 0, 'removals are reported for the inspector');
  assert.deepEqual(extractSvgViewBox('<svg viewBox="0 0 32 16"><g /></svg>'), {
    minX: 0,
    minY: 0,
    width: 32,
    height: 16,
  });
  assert.equal(extractSvgViewBox('<svg></svg>'), null, 'a missing viewBox is not invented');
  assert.equal(extractSvgViewBox('<svg viewBox="0 0 0 10"></svg>'), null, 'a zero-sized viewBox is rejected');
} else {
  assert.equal(benign.ok, false, 'a DOM-less environment never claims success');
  assert.equal(benign.reason, 'unsupported-environment', 'the reason is explicit for the UI');
  assert.equal(benign.markup, '', 'no markup leaks through a failed sanitization');
  assert.equal(extractSvgViewBox('<svg viewBox="0 0 32 16"></svg>'), null, 'viewBox parsing also fails closed');
}

const empty = sanitizeSvgMarkup('   ');
assert.equal(empty.ok, false, 'empty input is a fail-closed error state');
assert.equal(empty.reason, 'empty-input', 'empty input is distinguished from an unsupported environment');
assert.ok(describeSanitizeResult(empty).length > 0, 'error states carry a human-readable message');

const notSvg = sanitizeSvgMarkup('<div>not an svg</div>');
assert.equal(notSvg.ok, false, 'a non-SVG root is rejected before purification');
assert.equal(notSvg.reason, 'non-svg-root');
assert.equal(hasSvgRoot('<div>not an svg</div>'), false, 'non-SVG markup is recognised as such');

console.log('phase-3 smoke: all assertions passed');
