/**
 * Phase 4 smoke suite: playback clock math, the storage envelope round trip and
 * the keyboard/pointer invariants the gizmo and scrubber rely on.
 *
 * Runs under plain Node (no DOM), so it covers the pure decision logic that the
 * hooks delegate to. Assertions are behaviour, not implementation details.
 */

import assert from 'node:assert/strict';
import {
  createIterationClock,
  currentTimeToPercent,
  currentTimeToProgress,
  effectiveDurationMs,
  isFinished,
  isIterationReversed,
  isWithinDelay,
  iterationCount,
  iterationDurationMs,
  percentToCurrentTime,
  progressToCurrentTime,
  resolveIterationCount,
  totalActiveDurationMs,
} from '@/lib/animationClock';
import {
  clearActiveProject,
  loadActiveProject,
  resetStorageProbe,
  saveActiveProject,
  subscribeToActiveProjectChanges,
  STORAGE_KEYS,
  STORAGE_SCHEMA_VERSION,
  writeRawActiveProject,
} from '@/lib/storage';
import {
  createKeyframePoint,
  createKeyframeProperties,
  createProjectRecord,
  createTimeline,
  DEFAULT_TRANSFORM_PROPERTIES,
} from '@/types/sandbox';

let checks = 0;
function check(label: string, fn: () => void): void {
  fn();
  checks += 1;
  process.stdout.write(`  ✓ ${label}\n`);
}

const round = (value: number, digits = 4): number => Number(value.toFixed(digits));

// --- Iteration resolution ---------------------------------------------------

check("resolveIterationCount floors and keeps 'infinite'", () => {
  assert.equal(resolveIterationCount(2.7), 2);
  assert.equal(resolveIterationCount(0), 1);
  assert.equal(resolveIterationCount(Number.NaN), 1);
  assert.equal(resolveIterationCount('infinite'), Number.POSITIVE_INFINITY);
});

check('iterationCount and durations ignore invalid input', () => {
  const clock = createIterationClock({ durationMs: -50, delayMs: Number.NaN, iterationCount: 3, direction: 'normal' });
  assert.equal(iterationCount(clock), 3);
  assert.equal(iterationDurationMs(clock), 0);
  assert.equal(totalActiveDurationMs(clock), 0);
  assert.equal(currentTimeToProgress(500, clock), 0);
});

check('infinite iterations produce an infinite active duration', () => {
  const clock = createIterationClock({ durationMs: 1200, delayMs: 0, iterationCount: 'infinite', direction: 'normal' });
  assert.equal(totalActiveDurationMs(clock), Number.POSITIVE_INFINITY);
  assert.equal(isFinished(9_999_999, clock), false);
});

// --- Progress ⇄ time --------------------------------------------------------

const normalClock = createIterationClock({ durationMs: 2000, delayMs: 300, iterationCount: 1, direction: 'normal' });

check('currentTimeToProgress subtracts the delay and clamps', () => {
  assert.equal(currentTimeToProgress(0, normalClock), 0);
  assert.equal(currentTimeToProgress(300, normalClock), 0);
  assert.equal(currentTimeToProgress(1300, normalClock), 0.5);
  assert.equal(currentTimeToProgress(2300, normalClock), 1);
  assert.equal(currentTimeToProgress(99_999, normalClock), 1);
  assert.ok(isWithinDelay(120, normalClock));
  assert.equal(isWithinDelay(400, normalClock), false);
});

check('progressToCurrentTime is the inverse for a normal iteration', () => {
  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    const time = progressToCurrentTime(progress, normalClock);
    assert.equal(round(currentTimeToProgress(time, normalClock)), round(progress));
  }
  assert.equal(progressToCurrentTime(2, normalClock), 2300);
  assert.equal(progressToCurrentTime(-1, normalClock), 300);
  assert.equal(progressToCurrentTime(Number.NaN, normalClock), 300);
});

check('reverse mirrors progress inside the iteration', () => {
  const reverse = createIterationClock({ durationMs: 1000, delayMs: 0, iterationCount: 1, direction: 'reverse' });
  assert.equal(currentTimeToProgress(250, reverse), 0.75);
  assert.equal(currentTimeToProgress(1000, reverse), 0);
  // Seeking to 0% on a reversed timeline lands at the end of the iteration.
  assert.equal(percentToCurrentTime(0, reverse), 1000);
  assert.equal(percentToCurrentTime(100, reverse), 0);
});

check('alternate flips on odd iterations only', () => {
  const alternate = createIterationClock({ durationMs: 1000, delayMs: 0, iterationCount: 2, direction: 'alternate' });
  assert.equal(isIterationReversed('alternate', 0), false);
  assert.equal(isIterationReversed('alternate', 1), true);
  assert.equal(isIterationReversed('alternate-reverse', 0), true);
  assert.equal(isIterationReversed('alternate-reverse', 1), false);
  assert.equal(isIterationReversed('reverse', 7), true);
  // Second iteration runs 1250 → 1750 in time and reports 0.75 → 0.25.
  assert.equal(round(currentTimeToProgress(1250, alternate)), 0.75);
  assert.equal(round(currentTimeToProgress(1750, alternate)), 0.25);
  assert.equal(round(currentTimeToProgress(999, alternate)), 0.999);
});

check('multi-iteration progress restarts every cycle', () => {
  const triple = createIterationClock({ durationMs: 500, delayMs: 100, iterationCount: 3, direction: 'normal' });
  assert.equal(totalActiveDurationMs(triple), 1500);
  assert.equal(round(currentTimeToProgress(1600, triple)), 1, 'clamped to the final iteration end');
  // Time keeps running forward; progress restarts at 0 for every new iteration.
  assert.equal(round(currentTimeToProgress(1100, triple)), 0, 'start of the third iteration');
  assert.equal(round(currentTimeToProgress(1099, triple)), 0.998, 'near the end of the second iteration');
  assert.equal(round(currentTimeToProgress(600, triple)), 0, 'start of the second iteration');
  assert.equal(round(currentTimeToProgress(599, triple)), 0.998, 'near the end of the first iteration');
  assert.equal(isFinished(1600, triple), true);
  assert.equal(isFinished(1590, triple), false);
});

check('effectiveDurationMs applies the speed multiplier', () => {
  assert.equal(effectiveDurationMs(createIterationClock({ durationMs: 2000, delayMs: 0, iterationCount: 1, direction: 'normal' })), 2000);
  assert.equal(effectiveDurationMs(createIterationClock({ durationMs: 2000, delayMs: 0, iterationCount: 1, direction: 'normal' }, 0.5)), 4000);
  // Out-of-range speeds clamp into the supported band instead of producing Infinity.
  assert.equal(effectiveDurationMs(createIterationClock({ durationMs: 1000, delayMs: 0, iterationCount: 1, direction: 'normal' }, 0)), 10000);
  assert.equal(effectiveDurationMs(createIterationClock({ durationMs: 1000, delayMs: 0, iterationCount: 1, direction: 'normal' }, 99)), 250);
  assert.equal(effectiveDurationMs(createIterationClock({ durationMs: 1000, delayMs: 0, iterationCount: 1, direction: 'normal' }, Number.NaN)), 1000);
});

check('currentTimeToPercent stays inside 0…100 for every clock shape', () => {
  const clocks = [
    normalClock,
    createIterationClock({ durationMs: 0, delayMs: 0, iterationCount: 'infinite', direction: 'alternate' }),
    createIterationClock({ durationMs: 300, delayMs: 1200, iterationCount: 4, direction: 'alternate-reverse' }),
  ];
  for (const clock of clocks) {
    for (const time of [-500, 0, 1, 42, 999, 5000, Number.POSITIVE_INFINITY, Number.NaN]) {
      const percent = currentTimeToPercent(time, clock);
      assert.ok(percent >= 0 && percent <= 100, `percent ${percent} out of range for time ${time}`);
    }
  }
});

// --- Storage envelope -------------------------------------------------------

/** Minimal `Storage` double with an optional failure mode. */
interface FakeStorageFailure {
  /** Error name thrown by every read. */
  read?: string;
  /** Rejects values longer than this, like a per-item browser limit. */
  maxValueLength?: number;
}

class FakeStorage implements Storage {
  private readonly map = new Map<string, string>();
  private readonly failure: FakeStorageFailure;

  constructor(failure: FakeStorageFailure = {}) {
    this.failure = failure;
  }

  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    if (this.failure.read) throw new Error(this.failure.read);
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    // The support probe writes '1', so a size cap only rejects real payloads.
    if (this.failure.maxValueLength !== undefined && value.length > this.failure.maxValueLength) {
      const error = new Error('NS_ERROR_DOM_QUOTA_REACHED');
      error.name = 'NS_ERROR_DOM_QUOTA_REACHED';
      throw error;
    }
    this.map.set(key, value);
  }
}

interface FakeWindow {
  localStorage: Storage;
  addEventListener: (type: string, handler: (event: StorageEvent) => void) => void;
  removeEventListener: (type: string, handler: (event: StorageEvent) => void) => void;
  dispatchEvent: (event: Event) => boolean;
}

/**
 * `lib/storage` talks to `window.localStorage` and caches a support probe, so
 * every case swaps the whole window and re-probes — exactly what a private-mode
 * browser or a second tab looks like to the module.
 */
function withWindow<T>(storage: Storage, run: () => T): T {
  const original = (globalThis as { window?: FakeWindow }).window;
  const listeners = new Set<(event: StorageEvent) => void>();
  const fakeWindow: FakeWindow = {
    localStorage: storage,
    addEventListener: (_type, handler) => listeners.add(handler),
    removeEventListener: (_type, handler) => listeners.delete(handler),
    dispatchEvent: (event) => {
      for (const handler of listeners) handler(event as StorageEvent);
      return true;
    },
  };
  Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true, writable: true });
  resetStorageProbe();
  try {
    return run();
  } finally {
    resetStorageProbe();
    if (original === undefined) {
      delete (globalThis as { window?: FakeWindow }).window;
    } else {
      Object.defineProperty(globalThis, 'window', { value: original, configurable: true, writable: true });
    }
  }
}

const timeline = createTimeline({
  name: 'Clock demo',
  durationMs: 1800,
  delayMs: 200,
  keyframes: [
    createKeyframePoint({ offset: 0 }),
    createKeyframePoint({
      offset: 100,
      properties: createKeyframeProperties({
        transform: { ...DEFAULT_TRANSFORM_PROPERTIES, translateX: 64, translateY: -24, rotateZ: 45, scaleX: 1.2 },
      }),
    }),
  ],
});
const project = createProjectRecord({ name: 'Phase 4 clock demo', timelines: [timeline] });

// One storage instance is shared by the first three cases so the round trip is
// observed through the same origin, exactly like a page reload.
const sharedStorage = new FakeStorage();

check('save/load round trip preserves the project', () => {
  withWindow(sharedStorage, () => {
    clearActiveProject();
    assert.equal(loadActiveProject().status, 'empty');

    const write = saveActiveProject(project, 1_700_000_000_000);
    assert.equal(write.status, 'ok');
    assert.equal(write.degraded, false);

    const loaded = loadActiveProject();
    assert.equal(loaded.status, 'ok');
    if (loaded.status !== 'ok') return;
    assert.equal(loaded.envelope.savedAt, 1_700_000_000_000);
    assert.equal(loaded.envelope.project.name, project.name);
    assert.equal(loaded.envelope.project.activeTimelineId, timeline.id);
    assert.equal(loaded.envelope.project.timelines[0].keyframes.length, 2);
    assert.equal(loaded.envelope.project.timelines[0].keyframes[1].properties.transform.rotateZ, 45);
    assert.deepEqual(loaded.migrations, []);
  });
});

check('a re-save keeps the original updatedAt stamp', () => {
  withWindow(sharedStorage, () => {
    const loaded = loadActiveProject();
    assert.equal(loaded.status, 'ok');
    if (loaded.status !== 'ok') return;
    const original = loaded.envelope.project.updatedAt;
    saveActiveProject({ ...loaded.envelope.project, name: 'Renamed' }, 1_700_000_999_000);
    const reloaded = loadActiveProject();
    assert.equal(reloaded.status, 'ok');
    if (reloaded.status !== 'ok') return;
    assert.equal(reloaded.envelope.project.updatedAt, original);
    assert.equal(reloaded.envelope.project.name, 'Renamed');
    assert.equal(reloaded.envelope.savedAt, 1_700_000_999_000);
  });
});

check('clearActiveProject empties the store', () => {
  withWindow(sharedStorage, () => {
    assert.equal(loadActiveProject().status, 'ok', 'the shared store still holds the previous save');
    clearActiveProject();
    assert.equal(loadActiveProject().status, 'empty');
    // The memory mirror is cleared too, so no case can leak into the next.
    withWindow(new FakeStorage(), () => {
      assert.equal(loadActiveProject().status, 'empty');
    });
  });
});

check('corrupt payloads surface as a recoverable status', () => {
  withWindow(new FakeStorage(), () => {
    clearActiveProject();
    writeRawActiveProject('{not json');
    const result = loadActiveProject();
    assert.equal(result.status, 'corrupt');
    if (result.status !== 'corrupt') return;
    assert.ok(result.message.length > 0);
    assert.deepEqual(result.migrations, []);
  });
});

check('a quota rejection degrades to memory instead of throwing', () => {
  withWindow(new FakeStorage({ maxValueLength: 64 }), () => {
    clearActiveProject();
    const result = saveActiveProject(project, 1_700_000_000_000);
    assert.equal(result.status, 'quota-exceeded');
    assert.equal(result.degraded, true);
    assert.ok(result.message.length > 0);
    // The session keeps working: the payload lives in the memory mirror.
    const loaded = loadActiveProject();
    assert.equal(loaded.status, 'ok');
    if (loaded.status !== 'ok') return;
    assert.equal(loaded.envelope.project.name, project.name);
  });
});

check('an unreadable store still saves and reads back from the mirror', () => {
  withWindow(new FakeStorage({ read: 'SecurityError' }), () => {
    clearActiveProject();
    // The support probe only writes, so a write-only store is considered
    // available: the write succeeds and is not reported as degraded.
    const write = saveActiveProject(project, 1_700_000_000_000);
    assert.equal(write.status, 'ok');
    assert.equal(write.degraded, false);
    // Reads throw inside the browser; the wrapper falls back to the mirror, so
    // the caller still gets the project it just saved instead of an error.
    const loaded = loadActiveProject();
    assert.equal(loaded.status, 'ok');
    if (loaded.status !== 'ok') return;
    assert.equal(loaded.envelope.project.timelines[0].durationMs, 1800);
  });
});

/** Node has no `StorageEvent`, so the handler is fed a faithful shape. */
function storageEvent(key: string, newValue: string | null): StorageEvent {
  return { type: 'storage', key, newValue, oldValue: null, storageArea: null } as unknown as StorageEvent;
}

check('cross-tab writes notify subscribers and ignore foreign keys', () => {
  withWindow(sharedStorage, () => {
    clearActiveProject();
    const seen: Array<string | null> = [];
    const unsubscribe = subscribeToActiveProjectChanges((change) => {
      seen.push(change.project ? change.project.name : null);
    });
    const windowRef = (globalThis as { window: FakeWindow }).window;
    windowRef.dispatchEvent(
      storageEvent(STORAGE_KEYS.activeProject, JSON.stringify({
        schemaVersion: STORAGE_SCHEMA_VERSION,
        savedAt: 1_700_000_000_000,
        project: { ...project, name: 'From another tab' },
      })),
    );
    // Unrelated keys and other tabs' namespaces must not reach the handler.
    windowRef.dispatchEvent(storageEvent('unrelated:key', '{}'));
    windowRef.dispatchEvent(storageEvent('css-animation-sandbox:active-timelines', '[]'));
    // A removal in another tab arrives as newValue === null.
    windowRef.dispatchEvent(storageEvent(STORAGE_KEYS.activeProject, null));
    unsubscribe();
    windowRef.dispatchEvent(storageEvent(STORAGE_KEYS.activeProject, JSON.stringify({
      schemaVersion: STORAGE_SCHEMA_VERSION,
      savedAt: 1,
      project: { ...project, name: 'After unsubscribe' },
    })));
    assert.deepEqual(seen, ['From another tab', null]);
  });
});

process.stdout.write(`\nPhase 4 smoke: ${checks} checks passed\n`);
