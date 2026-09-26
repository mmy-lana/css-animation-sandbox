/**
 * Typed persistence layer.
 *
 * Responsibilities:
 * 1. **Single-tab persistence** — one active project under a namespaced key,
 *    written through a typed `localStorage` wrapper.
 * 2. **Graceful degradation** — private-mode browsers, disabled storage and
 *    quota errors fall back to an in-memory map instead of throwing, and every
 *    call reports its outcome through a discriminated result.
 * 3. **Schema migration** — stored envelopes carry a `schemaVersion`; legacy
 *    payloads are migrated forward field by field instead of being discarded.
 * 4. **Multi-tab awareness** — a `storage` event listener lets the app reload
 *    the active project when another tab writes to it. The tab that performed
 *    the write never receives its own event (browser guarantee), so the hook
 *    layer can apply changes locally without a feedback loop.
 *
 * Server-safe: every DOM/global access is guarded and lazily initialised.
 */

import {
  DEFAULT_CUBIC_BEZIER,
  DEFAULT_PREVIEW_CONFIG,
  DEFAULT_STYLE_PROPERTIES,
  clampNumber,
  createKeyframePoint,
  createProjectRecord,
  isAnimationDirection,
  isAnimationFillMode,
  isPreviewElementShape,
  isTimingPreset,
  isViewportBackground,
  roundTo,
  sortKeyframesByOffset,
  type AnimationIteration,
  type AnimationTimeline,
  type CubicBezierPoints,
  type KeyframePoint,
  type PreviewConfig,
  type ProjectRecord,
  type StyleProperties,
} from '@/types/sandbox';

// ---------------------------------------------------------------------------
// Keys & schema version
// ---------------------------------------------------------------------------

export const STORAGE_NAMESPACE = 'css-animation-sandbox';

/** Every key this app owns, namespaced to avoid collisions with other tools. */
export const STORAGE_KEYS = {
  activeProject: `${STORAGE_NAMESPACE}:active-project`,
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/** Bump when the persisted shape changes and a chain entry must be added. */
export const STORAGE_SCHEMA_VERSION = 2;

export interface StorageEnvelope {
  schemaVersion: number;
  savedAt: number;
  project: ProjectRecord;
}

// ---------------------------------------------------------------------------
// Result types — the API never throws
// ---------------------------------------------------------------------------

export type WriteStatus = 'ok' | 'quota-exceeded' | 'unavailable' | 'serialization-failed';

export interface WriteResult {
  status: WriteStatus;
  message: string;
  /** True when the payload lives in the in-memory fallback instead of on disk. */
  degraded: boolean;
}

export type LoadResult =
  | { status: 'ok'; envelope: StorageEnvelope; migratedFrom: number | null; migrations: MigrationId[] }
  | { status: 'empty' }
  | { status: 'corrupt'; message: string; migrations: MigrationId[] };

export interface ProjectStorageChange {
  key: string;
  project: ProjectRecord | null;
  /** True when the payload had to be migrated or coerced to be usable. */
  migrated: boolean;
}

// ---------------------------------------------------------------------------
// Low-level storage adapter with in-memory fallback
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, string>();

let storageAvailable: boolean | undefined;

/** True when a real, writable `localStorage` is reachable (probed once). */
export function isLocalStorageAvailable(): boolean {
  if (storageAvailable !== undefined) return storageAvailable;
  if (typeof window === 'undefined') {
    storageAvailable = false;
    return storageAvailable;
  }
  try {
    const probeKey = `${STORAGE_NAMESPACE}:__probe__`;
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  return storageAvailable;
}

/** Clears the cached probe result; the next call re-detects storage support. */
export function resetStorageProbe(): void {
  storageAvailable = undefined;
}

function readRaw(key: string): string | null {
  if (isLocalStorageAvailable()) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      /* fall through to the memory mirror */
    }
  }
  return memoryStore.get(key) ?? null;
}

type RawWriteResult = { ok: true } | { ok: false; status: WriteStatus; message: string };

function writeRaw(key: string, value: string): RawWriteResult {
  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.setItem(key, value);
      memoryStore.set(key, value);
      return { ok: true };
    } catch (error) {
      storageAvailable = false;
      const name = error instanceof Error ? error.name : '';
      if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        memoryStore.set(key, value);
        return { ok: false, status: 'quota-exceeded', message: 'Browser storage quota exceeded.' };
      }
      memoryStore.set(key, value);
      return { ok: false, status: 'unavailable', message: 'localStorage write was rejected by the browser.' };
    }
  }
  memoryStore.set(key, value);
  return { ok: true };
}

function removeRaw(key: string): void {
  memoryStore.delete(key);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nothing to clean up when the browser refuses the call */
  }
}

// ---------------------------------------------------------------------------
// Runtime coercion helpers (stored JSON is untrusted input)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function coerceNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clampNumber(value, min, max, fallback) : fallback;
}

function coerceIteration(value: unknown, fallback: AnimationIteration): AnimationIteration {
  if (value === 'infinite') return 'infinite';
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(1, Math.round(value));
  return fallback;
}

function coerceBezier(value: unknown): CubicBezierPoints {
  if (!isRecord(value)) return { ...DEFAULT_CUBIC_BEZIER };
  return {
    x1: coerceNumber(value.x1, DEFAULT_CUBIC_BEZIER.x1, 0, 1),
    y1: coerceNumber(value.y1, DEFAULT_CUBIC_BEZIER.y1, -10, 10),
    x2: coerceNumber(value.x2, DEFAULT_CUBIC_BEZIER.x2, 0, 1),
    y2: coerceNumber(value.y2, DEFAULT_CUBIC_BEZIER.y2, -10, 10),
  };
}

function coerceTransformProperties(value: unknown): KeyframePoint['properties']['transform'] {
  const source = isRecord(value) ? value : {};
  const unit = source.translateUnit;
  return {
    translateX: coerceNumber(source.translateX, 0, -2_000, 2_000),
    translateY: coerceNumber(source.translateY, 0, -2_000, 2_000),
    translateZ: coerceNumber(source.translateZ, 0, -1_000, 1_000),
    translateUnit: unit === '%' || unit === 'rem' ? unit : 'px',
    rotateX: coerceNumber(source.rotateX, 0, -1_800, 1_800),
    rotateY: coerceNumber(source.rotateY, 0, -1_800, 1_800),
    rotateZ: coerceNumber(source.rotateZ, 0, -1_800, 1_800),
    scaleX: coerceNumber(source.scaleX, 1, 0, 10),
    scaleY: coerceNumber(source.scaleY, 1, 0, 10),
    scaleZ: coerceNumber(source.scaleZ, 1, 0, 10),
    skewX: coerceNumber(source.skewX, 0, -180, 180),
    skewY: coerceNumber(source.skewY, 0, -180, 180),
  };
}

function coerceFilterProperties(value: unknown): KeyframePoint['properties']['filter'] {
  const source = isRecord(value) ? value : {};
  return {
    blur: coerceNumber(source.blur, 0, 0, 200),
    brightness: coerceNumber(source.brightness, 100, 0, 400),
    contrast: coerceNumber(source.contrast, 100, 0, 400),
    grayscale: coerceNumber(source.grayscale, 0, 0, 100),
    hueRotate: coerceNumber(source.hueRotate, 0, -360, 360),
    invert: coerceNumber(source.invert, 0, 0, 100),
    opacity: coerceNumber(source.opacity, 100, 0, 100),
    saturate: coerceNumber(source.saturate, 100, 0, 400),
  };
}

function coerceStyleProperties(value: unknown): StyleProperties {
  const source = isRecord(value) ? value : {};
  const fallback: StyleProperties = DEFAULT_STYLE_PROPERTIES;
  return {
    opacity: coerceNumber(source.opacity, fallback.opacity, 0, 1),
    backgroundColor: coerceString(source.backgroundColor, fallback.backgroundColor),
    borderColor: coerceString(source.borderColor, fallback.borderColor),
    borderWidth: coerceNumber(source.borderWidth, fallback.borderWidth, 0, 64),
    borderRadius: coerceNumber(source.borderRadius, fallback.borderRadius, 0, 999),
    boxShadowX: coerceNumber(source.boxShadowX, fallback.boxShadowX, -999, 999),
    boxShadowY: coerceNumber(source.boxShadowY, fallback.boxShadowY, -999, 999),
    boxShadowBlur: coerceNumber(source.boxShadowBlur, fallback.boxShadowBlur, 0, 999),
    boxShadowSpread: coerceNumber(source.boxShadowSpread, fallback.boxShadowSpread, -999, 999),
    boxShadowColor: coerceString(source.boxShadowColor, fallback.boxShadowColor),
    boxShadowInset: coerceBoolean(source.boxShadowInset, fallback.boxShadowInset),
    transformOriginX: coerceNumber(source.transformOriginX, fallback.transformOriginX, -100, 200),
    transformOriginY: coerceNumber(source.transformOriginY, fallback.transformOriginY, -100, 200),
  };
}

function coerceKeyframe(value: unknown, index: number): KeyframePoint | null {
  if (!isRecord(value)) return null;
  const properties = isRecord(value.properties) ? value.properties : {};
  return {
    id: coerceString(value.id, `kf_restored_${index}`),
    offset: roundTo(coerceNumber(value.offset, 0, 0, 100), 2),
    timingFunction: isTimingPreset(value.timingFunction) ? value.timingFunction : 'ease-in-out',
    bezier: coerceBezier(value.bezier),
    properties: {
      transform: coerceTransformProperties(properties.transform),
      filter: coerceFilterProperties(properties.filter),
      styles: coerceStyleProperties(properties.styles),
    },
  };
}

/** Rebuilds a keyframe list that always has unique offsets and 0%/100% endpoints. */
function restoreKeyframes(rawKeyframes: unknown[], timelineIndex: number): KeyframePoint[] {
  const coerced = rawKeyframes
    .map((keyframe, keyframeIndex) => coerceKeyframe(keyframe, keyframeIndex))
    .filter((keyframe): keyframe is KeyframePoint => keyframe !== null);

  const withEndpoints: KeyframePoint[] = [];
  if (coerced.length === 0) {
    withEndpoints.push(createKeyframePoint({ id: `kf_${timelineIndex}_start`, offset: 0 }));
    withEndpoints.push(createKeyframePoint({ id: `kf_${timelineIndex}_end`, offset: 100 }));
  } else {
    if (coerced.some((keyframe) => keyframe.offset === 0)) {
      withEndpoints.push(...coerced);
    } else {
      withEndpoints.push(createKeyframePoint({ id: `kf_${timelineIndex}_start`, offset: 0 }));
      withEndpoints.push(...coerced);
    }
    if (!withEndpoints.some((keyframe) => keyframe.offset === 100)) {
      const last = withEndpoints[withEndpoints.length - 1];
      withEndpoints.push({ ...last, id: `kf_${timelineIndex}_end`, offset: 100 });
    }
  }

  // Duplicate offsets would make the CSS generator emit duplicate selector blocks.
  const deduped: KeyframePoint[] = [];
  for (const keyframe of sortKeyframesByOffset(withEndpoints)) {
    if (deduped.some((existing) => existing.offset === keyframe.offset)) continue;
    deduped.push(keyframe);
  }
  return deduped;
}

function coerceTimeline(value: unknown, index: number): AnimationTimeline | null {
  if (!isRecord(value)) return null;
  const rawKeyframes = Array.isArray(value.keyframes) ? value.keyframes : [];

  return {
    id: coerceString(value.id, `tl_restored_${index}`),
    name: coerceString(value.name, `Timeline ${index + 1}`),
    durationMs: coerceNumber(value.durationMs, 1_000, 16, 600_000),
    delayMs: coerceNumber(value.delayMs, 0, 0, 600_000),
    iterationCount: coerceIteration(value.iterationCount, 1),
    direction: isAnimationDirection(value.direction) ? value.direction : 'normal',
    fillMode: isAnimationFillMode(value.fillMode) ? value.fillMode : 'both',
    keyframes: restoreKeyframes(rawKeyframes, index),
  };
}

function coercePreviewConfig(value: unknown): PreviewConfig {
  const source = isRecord(value) ? value : {};
  const customSvgContent = typeof source.customSvgContent === 'string' ? source.customSvgContent : undefined;
  return {
    shape: isPreviewElementShape(source.shape) ? source.shape : DEFAULT_PREVIEW_CONFIG.shape,
    ...(customSvgContent !== undefined ? { customSvgContent } : {}),
    viewportBackground: isViewportBackground(source.viewportBackground)
      ? source.viewportBackground
      : DEFAULT_PREVIEW_CONFIG.viewportBackground,
    showAxes: coerceBoolean(source.showAxes, DEFAULT_PREVIEW_CONFIG.showAxes),
    showPerspectiveGuide: coerceBoolean(source.showPerspectiveGuide, DEFAULT_PREVIEW_CONFIG.showPerspectiveGuide),
    enableMotionTrails: coerceBoolean(source.enableMotionTrails, DEFAULT_PREVIEW_CONFIG.enableMotionTrails),
    stageLightingIntensity: coerceNumber(
      source.stageLightingIntensity,
      DEFAULT_PREVIEW_CONFIG.stageLightingIntensity,
      0,
      1,
    ),
  };
}

/**
 * Rehydrates a stored value into a valid `ProjectRecord`, coercing every field
 * and repairing the structural invariants the rest of the app depends on.
 * Returns `null` when the payload contains no usable timeline.
 */
export function normalizeProjectRecord(value: unknown): ProjectRecord | null {
  if (!isRecord(value)) return null;

  const rawTimelines = Array.isArray(value.timelines) ? value.timelines : [];
  const timelines = rawTimelines
    .map((timeline, index) => coerceTimeline(timeline, index))
    .filter((timeline): timeline is AnimationTimeline => timeline !== null);

  if (timelines.length === 0) return null;

  const requestedActive = typeof value.activeTimelineId === 'string' ? value.activeTimelineId : '';
  const base = createProjectRecord({
    name: coerceString(value.name, 'Untitled Sandbox'),
    description: typeof value.description === 'string' ? value.description : '',
    createdAt: coerceNumber(value.createdAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
    updatedAt: coerceNumber(value.updatedAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
  });

  return {
    ...base,
    id: coerceString(value.id, base.id),
    timelines,
    activeTimelineId: timelines.some((timeline) => timeline.id === requestedActive) ? requestedActive : timelines[0].id,
    preview: coercePreviewConfig(value.preview),
  };
}

// ---------------------------------------------------------------------------
// Migration chain
// ---------------------------------------------------------------------------

export type MigrationId =
  | 'wrap-legacy-project-in-envelope'
  | 'add-preview-background-and-lighting'
  | 'sort-timeline-keyframes'
  | 'coerce-invalid-fields';

interface Migration {
  readonly id: MigrationId;
  /** Inclusive lower bound of the source schema version. */
  readonly from: number;
  /** Exclusive upper bound of the source schema version. */
  readonly to: number;
  readonly apply: (project: ProjectRecord) => ProjectRecord;
}

const MIGRATION_CHAIN: readonly Migration[] = [
  {
    id: 'add-preview-background-and-lighting',
    from: 1,
    to: 2,
    apply: (project) => ({
      ...project,
      preview: {
        ...project.preview,
        viewportBackground: project.preview.viewportBackground ?? DEFAULT_PREVIEW_CONFIG.viewportBackground,
        stageLightingIntensity: project.preview.stageLightingIntensity ?? DEFAULT_PREVIEW_CONFIG.stageLightingIntensity,
      },
    }),
  },
  {
    id: 'sort-timeline-keyframes',
    from: 1,
    to: 2,
    apply: (project) => ({
      ...project,
      timelines: project.timelines.map((timeline) => ({
        ...timeline,
        keyframes: sortKeyframesByOffset(timeline.keyframes),
      })),
    }),
  },
  {
    id: 'coerce-invalid-fields',
    from: 1,
    to: 2,
    apply: (project) => ({
      ...project,
      timelines: project.timelines.map((timeline) => ({
        ...timeline,
        iterationCount: coerceIteration(timeline.iterationCount, 1),
        direction: isAnimationDirection(timeline.direction) ? timeline.direction : 'normal',
        fillMode: isAnimationFillMode(timeline.fillMode) ? timeline.fillMode : 'both',
      })),
    }),
  },
];

export interface MigrationOutcome {
  /** `null` when the payload could not be repaired into a usable project. */
  envelope: StorageEnvelope | null;
  fromVersion: number;
  migrations: MigrationId[];
}

/** Detects the schema version of a raw stored payload. `0` = legacy bare record. */
export function detectSchemaVersion(raw: unknown): number {
  if (isRecord(raw) && typeof raw.schemaVersion === 'number' && isRecord(raw.project)) {
    return raw.schemaVersion;
  }
  return 0;
}

/**
 * Normalizes and migrates a raw stored payload up to
 * {@link STORAGE_SCHEMA_VERSION}. Payloads written by a *newer* schema are
 * returned as-is (they are never downgraded destructively).
 */
export function migrateStoragePayload(raw: unknown, now = Date.now()): MigrationOutcome {
  const fromVersion = detectSchemaVersion(raw);
  const applied: MigrationId[] = [];
  const envelopeSource = isRecord(raw) && isRecord(raw.project) ? raw.project : raw;
  const savedAt =
    isRecord(raw) && typeof raw.savedAt === 'number' && Number.isFinite(raw.savedAt) ? raw.savedAt : now;

  // A bare `ProjectRecord` is the pre-v1 shape: it only becomes a valid payload
  // by being wrapped in the envelope produced below.
  if (fromVersion === 0) applied.push('wrap-legacy-project-in-envelope');

  let project = normalizeProjectRecord(envelopeSource);
  if (!project) return { envelope: null, fromVersion, migrations: applied };

  let version = fromVersion;
  for (const migration of MIGRATION_CHAIN) {
    if (version < migration.from || version >= migration.to) continue;
    project = migration.apply(project);
    applied.push(migration.id);
    version = migration.to;
  }

  return {
    envelope: { schemaVersion: Math.max(version, STORAGE_SCHEMA_VERSION), savedAt, project },
    fromVersion,
    migrations: applied,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function parsePayload(raw: string): { parsed: unknown } | { parsed: null } {
  try {
    return { parsed: JSON.parse(raw) as unknown };
  } catch {
    return { parsed: null };
  }
}

/** Reads and migrates the persisted active project. Never throws. */
export function loadActiveProject(): LoadResult {
  const raw = readRaw(STORAGE_KEYS.activeProject);
  if (raw === null || raw.length === 0) return { status: 'empty' };

  const { parsed } = parsePayload(raw);
  if (parsed === null) {
    return { status: 'corrupt', message: 'Stored project is not valid JSON.', migrations: [] };
  }

  const outcome = migrateStoragePayload(parsed);
  if (!outcome.envelope) {
    return {
      status: 'corrupt',
      message: 'Stored project does not contain a usable timeline.',
      migrations: outcome.migrations,
    };
  }

  return {
    status: 'ok',
    envelope: outcome.envelope,
    migratedFrom: outcome.fromVersion === outcome.envelope.schemaVersion ? null : outcome.fromVersion,
    migrations: outcome.migrations,
  };
}

/** Persists the active project. Never throws; reports quota/availability issues. */
export function saveActiveProject(project: ProjectRecord, now = Date.now()): WriteResult {
  const envelope: StorageEnvelope = {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    savedAt: now,
    project: { ...project, updatedAt: project.updatedAt || now },
  };

  let serialized: string;
  try {
    serialized = JSON.stringify(envelope);
  } catch (error) {
    return {
      status: 'serialization-failed',
      message: error instanceof Error ? error.message : 'Project could not be serialized.',
      degraded: false,
    };
  }

  const result = writeRaw(STORAGE_KEYS.activeProject, serialized);
  if (result.ok) {
    return {
      status: 'ok',
      message: 'Project saved.',
      degraded: !isLocalStorageAvailable(),
    };
  }
  return {
    status: result.status,
    message: `${result.message} The project is kept in memory for this session only.`,
    degraded: true,
  };
}

/** Removes the persisted active project. */
export function clearActiveProject(): void {
  removeRaw(STORAGE_KEYS.activeProject);
}

/** Reads the raw stored payload without migration (diagnostics / tests). */
export function readRawActiveProject(): string | null {
  return readRaw(STORAGE_KEYS.activeProject);
}

/** Injects a raw payload, bypassing the writer (tests and import tooling). */
export function writeRawActiveProject(payload: string): void {
  writeRaw(STORAGE_KEYS.activeProject, payload);
}

/**
 * Subscribes to writes performed by *other* tabs for the active project.
 * Returns an unsubscribe function. No-op on the server.
 */
export function subscribeToActiveProjectChanges(handler: (change: ProjectStorageChange) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const listener = (event: StorageEvent): void => {
    if (event.key !== null && event.key !== STORAGE_KEYS.activeProject) return;

    if (event.newValue === null) {
      handler({ key: STORAGE_KEYS.activeProject, project: null, migrated: false });
      return;
    }

    const { parsed } = parsePayload(event.newValue);
    if (parsed === null) {
      handler({ key: STORAGE_KEYS.activeProject, project: null, migrated: false });
      return;
    }

    const outcome = migrateStoragePayload(parsed);
    handler({
      key: STORAGE_KEYS.activeProject,
      project: outcome.envelope?.project ?? null,
      migrated: outcome.migrations.length > 0,
    });
  };

  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener('storage', listener);
  };
}

/** Discards the in-memory fallback (used by tests). */
export function clearMemoryFallback(): void {
  memoryStore.clear();
}
