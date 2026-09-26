'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Crosshair,
  Eye,
  Gauge,
  Move,
  PanelRight,
  SlidersHorizontal,
  Type,
  Waves,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { DEFAULT_PROJECT as INITIAL_PROJECT } from '@/lib/defaultProject';
import { cubicBezierCoordinateAt, resolveTimingBezier, solveCubicBezierTimeForX } from '@/lib/bezier';
import { formatMillisecondsAsSeconds, interpolateKeyframeProperties, resolveSegmentAtOffset } from '@/lib/cssGenerator';
import { ExportDrawer } from '@/components/exporter/ExportDrawer';
import { BezierCurveEditor } from '@/components/inspector/BezierCurveEditor';
import { FilterControls } from '@/components/inspector/FilterControls';
import { PropertySection } from '@/components/inspector/PropertySection';
import { StyleControls } from '@/components/inspector/StyleControls';
import { TransformControls } from '@/components/inspector/TransformControls';
import { PresetDrawer } from '@/components/navigation/PresetDrawer';
import { StudioTopNav } from '@/components/navigation/StudioTopNav';
import type { GizmoMode } from '@/components/stage/TransformGizmo';
import { ViewportStage } from '@/components/stage/ViewportStage';
import { ScrubBar } from '@/components/timeline/ScrubBar';
import { TimelineHeader } from '@/components/timeline/TimelineHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { useAnimationEngine } from '@/hooks/useAnimationEngine';
import { useHistoryState } from '@/hooks/useHistoryState';
import { useLocalStorageSync } from '@/hooks/useLocalStorageSync';
import { useTimelineScrubber } from '@/hooks/useTimelineScrubber';
import {
  DEFAULT_EXPORT_OPTIONS,
  TIMING_PRESETS,
  TIMING_PRESET_LABELS,
  addTimeline,
  createKeyframePoint,
  createTimeline,
  findKeyframe,
  getActiveTimeline,
  insertKeyframe,
  moveKeyframeOffset,
  mutationSuccess,
  patchKeyframeProperties,
  removeKeyframe,
  removeTimeline,
  setActiveTimeline,
  touchProject,
  updateKeyframe,
  updateTimeline,
  validateTimelineTiming,
  type AnimationTimeline,
  type CubicBezierPoints,
  type ExportOptions,
  type KeyframeProperties,
  type MutationResult,
  type PartialKeyframeProperties,
  type PreviewConfig,
  type ProjectRecord,
  type TimingPreset,
  type ValidationError,
} from '@/types/sandbox';

type MobilePane = 'preview' | 'inspector' | 'timeline';

const MOBILE_PANES: ReadonlyArray<{ value: MobilePane; label: string; icon: typeof Eye }> = [
  { value: 'preview', label: 'Preview', icon: Eye },
  { value: 'inspector', label: 'Inspector', icon: SlidersHorizontal },
  { value: 'timeline', label: 'Timeline', icon: PanelRight },
];

const GIZMO_MODES: ReadonlyArray<{ value: GizmoMode; label: string }> = [
  { value: 'translate', label: 'Move' },
  { value: 'rotate', label: 'Rotate' },
  { value: 'off', label: 'Gizmo off' },
];

const TIMING_OPTIONS: ReadonlyArray<{ value: TimingPreset; label: string }> = TIMING_PRESETS.map((value) => ({
  value,
  label: TIMING_PRESET_LABELS[value],
}));

/** Deep comparison for the undo stack; projects are small and compared rarely. */
function projectsEqual(a: ProjectRecord, b: ProjectRecord): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function describeStatus(
  status: 'hydrating' | 'idle' | 'saving' | 'saved' | 'error',
  message: string | null,
  lastSavedAt: number | null,
): string {
  if (status === 'error') return message ?? 'Save failed';
  if (status === 'saving') return 'Saving…';
  if (status === 'hydrating') return 'Restoring…';
  if (status === 'saved' && lastSavedAt !== null) {
    return `Saved at ${new Date(lastSavedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })}`;
  }
  return 'Autosave on';
}

export default function SandboxPage() {
  // --- Document, history and persistence ----------------------------------
  const storage = useLocalStorageSync({ initialProject: INITIAL_PROJECT, debounceMs: 400 });
  const history = useHistoryState<ProjectRecord>({ initialState: INITIAL_PROJECT, isEqual: projectsEqual });
  const {
    state: project,
    preview: previewState,
    commit: commitState,
    beginGesture,
    endGesture,
    replace: replaceState,
    undo,
    redo,
    canUndo,
    canRedo,
    undoDepth,
    redoDepth,
  } = history;
  const gestureOpenRef = useRef(false);

  // Storage and history are two views of one document. A local edit flows
  // history → storage, while hydration and cross-tab writes flow the other way;
  // whichever side moved last wins, so neither can clobber the other silently.
  const lastHistoryRef = useRef<ProjectRecord | null>(null);
  const lastStorageRef = useRef<ProjectRecord | null>(null);
  useEffect(() => {
    if (!storage.isHydrated) return;
    const isFirstCommit = lastHistoryRef.current === null;
    const historyChanged = !isFirstCommit && lastHistoryRef.current !== project;
    const storageChanged = !isFirstCommit && lastStorageRef.current !== storage.project;
    lastHistoryRef.current = project;
    lastStorageRef.current = storage.project;

    if (isFirstCommit) {
      if (!projectsEqual(project, storage.project)) replaceState(storage.project);
      return;
    }
    if (historyChanged) {
      storage.setProject(project);
      return;
    }
    if (storageChanged && !projectsEqual(project, storage.project)) replaceState(storage.project);
  }, [project, replaceState, storage.isHydrated, storage.project, storage.setProject]);

  const [mutationErrors, setMutationErrors] = useState<ValidationError[]>([]);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('translate');
  const [perspective, setPerspective] = useState(800);
  const [trailSamples, setTrailSamples] = useState<string[]>([]);
  const [mobilePane, setMobilePane] = useState<MobilePane>('preview');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);

  const timeline = useMemo(() => getActiveTimeline(project) ?? createTimeline(), [project]);
  const targetRef = useRef<HTMLDivElement>(null);

  // --- Playback -----------------------------------------------------------
  const seekRef = useRef<(ratio: number) => void>(() => {});
  const onProgress = useCallback((percent: number) => {
    // The trail needs the poses, not percentages; the display properties below
    // supply the matching transform, so the offset identifies each sample.
    setTrailSamples((previous) => [...previous, percent.toFixed(2)].slice(-6));
  }, []);

  const engine = useAnimationEngine({
    timeline,
    targetRef,
    onProgress,
    defaultSpeed: 1,
    loop: false,
    driveNode: true,
  });

  const scrubber = useTimelineScrubber({
    durationMs: timeline.durationMs,
    delayMs: timeline.delayMs,
    onScrub: (offsetPercent) => {
      seekRef.current(offsetPercent / 100);
    },
    externalOffsetPercent: engine.isPlaying ? engine.progressPercent : null,
    disabled: !engine.canPlay,
  });

  useEffect(() => {
    seekRef.current = engine.seekRatio;
  }, [engine.seekRatio]);

  // Re-pose after an edit while paused: the persisted scrub animation would
  // otherwise keep showing the pre-edit keyframes.
  const poseRef = useRef<ProjectRecord | null>(null);
  const ratioRef = useRef(0);
  ratioRef.current = scrubber.progressRatio;
  useEffect(() => {
    if (engine.isPlaying || poseRef.current === project) return;
    poseRef.current = project;
    seekRef.current(ratioRef.current);
  }, [engine.isPlaying, project]);

  // --- Derived preview state ---------------------------------------------
  const segment = useMemo(() => resolveSegmentAtOffset(timeline, scrubber.offsetPercent), [
    scrubber.offsetPercent,
    timeline,
  ]);

  const displayProperties = useMemo<KeyframeProperties | null>(() => {
    if (!segment) return timeline.keyframes[0]?.properties ?? null;
    const bezier = resolveTimingBezier(segment.from.timingFunction, segment.from.bezier);
    const isLinear = bezier.x1 === 0 && bezier.y1 === 0 && bezier.x2 === 1 && bezier.y2 === 1;
    // Map linear time through the outgoing keyframe's easing so a paused
    // preview matches what the exported animation renders at this offset.
    const eased = isLinear
      ? segment.localProgress
      : cubicBezierCoordinateAt(solveCubicBezierTimeForX(segment.localProgress, bezier), bezier.y1, bezier.y2);
    return interpolateKeyframeProperties(segment.from, segment.to, eased);
  }, [segment, timeline.keyframes]);

  const selectedKeyframe = selectedKeyframeId ? findKeyframe(timeline, selectedKeyframeId) : undefined;
  const activeKeyframe = selectedKeyframe ?? segment?.from ?? timeline.keyframes[0] ?? null;
  const isInterpolating = Boolean(
    segment && segment.from.id !== segment.to.id && scrubber.offsetPercent > segment.from.offset + 0.05,
  );

  // --- Mutation plumbing --------------------------------------------------
  const dispatch = useCallback(
    (mutate: (current: ProjectRecord) => MutationResult<ProjectRecord>, commit: boolean) => {
      const result = mutate(project);
      if (!result.ok) {
        setMutationErrors(result.errors);
        if (!commit && gestureOpenRef.current) {
          endGesture();
          gestureOpenRef.current = false;
        }
        return;
      }
      setMutationErrors([]);
      const next = touchProject(result.value);
      if (!commit) {
        // A gesture is one undo entry: open it on the first transient step.
        if (!gestureOpenRef.current) {
          beginGesture();
          gestureOpenRef.current = true;
        }
        previewState(next);
        return;
      }
      if (gestureOpenRef.current) {
        previewState(next);
        endGesture();
        gestureOpenRef.current = false;
        return;
      }
      commitState(next);
    },
    [beginGesture, commitState, endGesture, previewState, project],
  );

  const applyTimelinePatch = useCallback(
    (patch: Partial<AnimationTimeline>, commit: boolean) => {
      dispatch((current) => updateTimeline(current, timeline.id, (existing) => ({ ...existing, ...patch })), commit);
    },
    [dispatch, timeline.id],
  );

  const patchActiveKeyframe = useCallback(
    (patch: PartialKeyframeProperties, commit: boolean) => {
      if (!activeKeyframe) return;
      dispatch((current) => patchKeyframeProperties(current, timeline.id, activeKeyframe.id, patch), commit);
    },
    [activeKeyframe, dispatch, timeline.id],
  );

  const setActiveKeyframeTiming = useCallback(
    (timingFunction: TimingPreset) => {
      if (!activeKeyframe) return;
      dispatch(
        (current) =>
          updateKeyframe(current, timeline.id, activeKeyframe.id, (keyframe) => ({
            ...keyframe,
            timingFunction,
            bezier: { ...resolveTimingBezier(timingFunction) },
          })),
        true,
      );
    },
    [activeKeyframe, dispatch, timeline.id],
  );

  const setActiveKeyframeBezier = useCallback(
    (bezier: CubicBezierPoints) => {
      if (!activeKeyframe) return;
      dispatch(
        (current) =>
          updateKeyframe(current, timeline.id, activeKeyframe.id, (keyframe) => ({
            ...keyframe,
            timingFunction: 'custom-cubic',
            bezier: { ...bezier },
          })),
        true,
      );
    },
    [activeKeyframe, dispatch, timeline.id],
  );

  const addKeyframeAtPlayhead = useCallback(() => {
    const offset = Math.round(scrubber.offsetPercent * 10) / 10;
    const duplicate = timeline.keyframes.find((keyframe) => Math.abs(keyframe.offset - offset) < 0.1);
    if (duplicate) {
      setSelectedKeyframeId(duplicate.id);
      setMutationErrors([
        { field: `keyframe.${duplicate.id}`, message: `A keyframe already exists at ${duplicate.offset}%.` },
      ]);
      return;
    }
    // The new keyframe inherits the resolved start state, so inserting one
    // mid-interpolation does not change the current frame.
    const template = segment?.from ?? activeKeyframe;
    const keyframe = createKeyframePoint({
      offset,
      timingFunction: 'ease-out',
      properties: template
        ? {
            transform: { ...template.properties.transform },
            filter: { ...template.properties.filter },
            styles: { ...template.properties.styles },
          }
        : undefined,
    });
    dispatch((current) => insertKeyframe(current, timeline.id, keyframe), true);
    setSelectedKeyframeId(keyframe.id);
  }, [activeKeyframe, dispatch, scrubber.offsetPercent, segment, timeline]);

  const deleteKeyframe = useCallback(
    (keyframeId: string) => {
      dispatch((current) => removeKeyframe(current, timeline.id, keyframeId), true);
      setSelectedKeyframeId((current) => (current === keyframeId ? null : current));
    },
    [dispatch, timeline.id],
  );

  const onKeyframeOffsetChange = useCallback(
    (keyframeId: string, offset: number, commit: boolean) => {
      setSelectedKeyframeId(keyframeId);
      dispatch((current) => moveKeyframeOffset(current, timeline.id, keyframeId, offset), commit);
    },
    [dispatch, timeline.id],
  );

  const applyPreset = useCallback(
    (presetTimeline: AnimationTimeline, presetPreview: Partial<PreviewConfig>, mode: 'replace' | 'append') => {
      // One dispatch, one undo entry: the timeline swap and the preview settings
      // a preset implies must never land as two separate history entries.
      dispatch((current) => {
        const result =
          mode === 'append'
            ? addTimeline(current, presetTimeline)
            : // Replacing keeps the active timeline's identity so the project's
              // active pointer and every saved keyframe reference stay valid.
              updateTimeline(current, timeline.id, () => ({ ...presetTimeline, id: timeline.id }));
        if (!result.ok) return result;
        return mutationSuccess({
          ...result.value,
          activeTimelineId: mode === 'append' ? presetTimeline.id : result.value.activeTimelineId,
          preview: { ...result.value.preview, ...presetPreview },
        });
      }, true);
      setSelectedKeyframeId(null);
      engine.stop();
      scrubber.setOffsetPercent(0, false);
      seekRef.current(0);
      setTrailSamples([]);
    },
    [dispatch, engine, scrubber, timeline.id],
  );

  // --- Keyboard shortcuts -------------------------------------------------
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  // --- Render data --------------------------------------------------------
  const timingErrors = useMemo(() => validateTimelineTiming(timeline), [timeline]);
  const canExport = timeline.keyframes.length >= 2;
  const isPlaying = engine.isPlaying;
  const activeBezier = activeKeyframe
    ? resolveTimingBezier(activeKeyframe.timingFunction, activeKeyframe.bezier)
    : null;

  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden bg-obsidian-950 text-zinc-200">
      <StudioTopNav
        project={project}
        activeTimelineName={timeline.name}
        status={storage.status}
        statusMessage={describeStatus(storage.status, storage.message, storage.lastSavedAt)}
        isDegraded={storage.isDegraded}
        wasMigrated={storage.wasMigrated}
        canUndo={canUndo}
        canRedo={canRedo}
        undoDepth={undoDepth}
        redoDepth={redoDepth}
        onUndo={undo}
        onRedo={redo}
        onOpenPresets={() => setIsPresetsOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onRenameProject={(name) => dispatch((current) => mutationSuccess({ ...current, name }), true)}
        disabled={!storage.isHydrated}
      />

      {mutationErrors.length > 0 ? (
        <div
          role="alert"
          className="flex items-start gap-2 border-b border-studio-danger/30 bg-studio-danger/10 px-3 py-1.5 text-[11px] text-studio-danger"
        >
          <AlertTriangle width={13} height={13} aria-hidden="true" className="mt-0.5 shrink-0" />
          <ul className="flex-1">
            {mutationErrors.map((error) => (
              <li key={`${error.field}-${error.message}`}>{error.message}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setMutationErrors([])}
            aria-label="Dismiss error"
            className="rounded p-0.5 hover:bg-studio-danger/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-accent"
          >
            <X width={12} height={12} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* Below 1024px one pane is shown at a time; from 1024px the three-pane studio. */}
      <div
        className="flex items-center gap-1 border-b border-obsidian-700/60 px-2 py-1.5 lg:hidden"
        role="tablist"
        aria-label="Studio panes"
      >
        {MOBILE_PANES.map((pane) => {
          const Icon = pane.icon;
          const isSelected = mobilePane === pane.value;
          return (
            <button
              key={pane.value}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setMobilePane(pane.value)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md border py-1.5 text-[11px] transition-colors',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-accent',
                isSelected
                  ? 'border-studio-accent/50 bg-studio-accent/10 text-studio-accent'
                  : 'border-obsidian-700/60 text-zinc-400',
              )}
            >
              <Icon width={13} height={13} aria-hidden="true" />
              {pane.label}
            </button>
          );
        })}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,19rem)] lg:overflow-hidden">
        <aside
          className={cn(
            'min-w-0 flex-col gap-3 overflow-y-auto p-3 lg:flex lg:border-r lg:border-obsidian-700/60',
            mobilePane === 'inspector' ? 'flex' : 'hidden',
          )}
          aria-label="Property inspector"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-[10px] tracking-widest text-zinc-500 uppercase">Inspector</h2>
            {activeKeyframe ? (
              <span className="readout ml-auto rounded bg-obsidian-800 px-1.5 py-0.5 text-[9px] text-zinc-400">
                {activeKeyframe.offset}%
              </span>
            ) : null}
          </div>

          {activeKeyframe && activeBezier ? (
            <>
              {isInterpolating ? (
                <p className="rounded-md border border-studio-violet-soft/30 bg-studio-violet/10 px-2 py-1.5 text-[10px] text-studio-violet-soft">
                  Editing the keyframe at {activeKeyframe.offset}%. Move the playhead onto it to see the change.
                </p>
              ) : null}

              <PropertySection
                title="Timing function"
                icon={Waves}
                description={`Eases the segment leaving ${activeKeyframe.offset}%`}
              >
                <div className="flex flex-col gap-2">
                  <Select
                    value={activeKeyframe.timingFunction}
                    options={TIMING_OPTIONS}
                    onChange={setActiveKeyframeTiming}
                    label="Easing preset"
                    size="sm"
                  />
                  <BezierCurveEditor bezier={activeBezier} onChange={setActiveKeyframeBezier} />
                </div>
              </PropertySection>

              <PropertySection
                title="Transform"
                icon={Move}
                badge={<span className="readout text-[9px] text-zinc-600">3D</span>}
              >
                <TransformControls
                  value={activeKeyframe.properties.transform}
                  onChange={(patch) => patchActiveKeyframe({ transform: patch }, true)}
                />
              </PropertySection>

              <PropertySection title="Filter" icon={Gauge} defaultOpen={false}>
                <FilterControls
                  value={activeKeyframe.properties.filter}
                  onChange={(patch) => patchActiveKeyframe({ filter: patch }, true)}
                />
              </PropertySection>

              <PropertySection title="Style" icon={SlidersHorizontal} defaultOpen={false}>
                <StyleControls
                  value={activeKeyframe.properties.styles}
                  onChange={(patch) => patchActiveKeyframe({ styles: patch }, true)}
                />
              </PropertySection>
            </>
          ) : (
            <div className="empty-grid flex flex-col items-center gap-2 rounded-lg border border-dashed border-obsidian-600 p-6 text-center">
              <AlertTriangle width={18} height={18} aria-hidden="true" className="text-studio-warning" />
              <p className="text-[11px] text-zinc-400">This timeline has no keyframes yet.</p>
              <p className="text-[10px] text-zinc-600">Add one at the playhead to start editing properties.</p>
            </div>
          )}

          <PropertySection
            title="Custom SVG"
            icon={Type}
            defaultOpen={project.preview.shape === 'custom-svg'}
            description="Sanitized with the SVG profile before it reaches the stage."
          >
            <textarea
              value={project.preview.customSvgContent ?? ''}
              onChange={(event) =>
                dispatch(
                  (current) =>
                    mutationSuccess({
                      ...current,
                      preview: { ...current.preview, customSvgContent: event.target.value },
                    }),
                  false,
                )
              }
              onBlur={(event) =>
                dispatch(
                  (current) =>
                    mutationSuccess({
                      ...current,
                      preview: { ...current.preview, customSvgContent: event.target.value },
                    }),
                  true,
                )
              }
              rows={5}
              spellCheck={false}
              placeholder="<svg viewBox='0 0 24 24'>…</svg>"
              aria-label="Custom SVG markup"
              className="w-full resize-y rounded-md border border-obsidian-700 bg-obsidian-900 p-2 font-mono text-[10px] text-zinc-200 outline-none placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-studio-accent"
            />
          </PropertySection>
        </aside>

        <section
          className={cn('min-w-0 flex-col p-3', mobilePane === 'preview' ? 'flex' : 'hidden lg:flex')}
          aria-label="Preview"
        >
          {displayProperties ? (
            <ViewportStage
              preview={project.preview}
              onPreviewChange={(patch, commit) =>
                dispatch(
                  (current) => mutationSuccess({ ...current, preview: { ...current.preview, ...patch } }),
                  commit,
                )
              }
              properties={displayProperties}
              shape={project.preview.shape}
              targetRef={targetRef}
              gizmoMode={gizmoMode}
              onTransformChange={(patch, commit) => patchActiveKeyframe({ transform: patch }, commit)}
              activeKeyframe={activeKeyframe}
              trailSamples={trailSamples}
              perspective={perspective}
              onPerspectiveChange={setPerspective}
              enable3dGizmo
              isPlaying={isPlaying}
            />
          ) : (
            <div className="empty-grid flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-obsidian-600 p-8 text-center">
              <AlertTriangle width={20} height={20} aria-hidden="true" className="text-studio-warning" />
              <p className="text-[11px] text-zinc-400">Nothing to preview — this timeline has no keyframes.</p>
              <Button variant="secondary" size="xs" iconLeft={Crosshair} onClick={addKeyframeAtPlayhead}>
                Add a keyframe
              </Button>
            </div>
          )}

          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-600">
            <kbd className="readout rounded border border-obsidian-700 px-1">←</kbd>
            <kbd className="readout rounded border border-obsidian-700 px-1">→</kbd>
            nudge the playhead · <kbd className="readout rounded border border-obsidian-700 px-1">⌘Z</kbd> undo ·
            <kbd className="readout rounded border border-obsidian-700 px-1">⇧⌘Z</kbd> redo
          </p>
        </section>

        <aside
          className={cn(
            'min-w-0 flex-col gap-3 overflow-y-auto p-3 lg:flex lg:border-l lg:border-obsidian-700/60',
            mobilePane === 'timeline' ? 'flex' : 'hidden',
          )}
          aria-label="Timeline settings"
        >
          <TimelineHeader
            timeline={timeline}
            onChange={applyTimelinePatch}
            onAddKeyframe={addKeyframeAtPlayhead}
            onDeleteKeyframe={activeKeyframe ? () => deleteKeyframe(activeKeyframe.id) : undefined}
            errors={timingErrors}
            canAddKeyframe={engine.canPlay}
            canDeleteKeyframe={Boolean(activeKeyframe) && timeline.keyframes.length > 1}
          />

          <div className="panel-surface flex flex-col gap-2 p-3">
            <h3 className="text-[10px] tracking-widest text-zinc-500 uppercase">Playback</h3>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={gizmoMode}
                options={GIZMO_MODES}
                onChange={setGizmoMode}
                label="Gizmo"
                size="sm"
                disabled={isPlaying}
              />
              <Slider
                label="Speed"
                value={engine.speed}
                min={0.1}
                max={4}
                step={0.1}
                onChange={engine.setSpeed}
                formatValue={(value) => `${value.toFixed(1)}×`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Switch
                checked={engine.loop}
                onCheckedChange={engine.setLoop}
                label="Loop forever"
                disabled={!engine.canPlay}
                className="min-w-28"
              />
              {engine.isClockFallback ? (
                <span className="rounded-md border border-studio-warning/40 bg-studio-warning/10 px-1.5 py-0.5 text-[9px] text-studio-warning">
                  Clock fallback
                </span>
              ) : null}
            </div>
          </div>

          <div className="panel-surface flex flex-col gap-2 p-3">
            <div className="flex items-center gap-2">
              <h3 className="text-[10px] tracking-widest text-zinc-500 uppercase">Keyframes</h3>
              <span className="readout ml-auto text-[9px] text-zinc-600">{timeline.keyframes.length} total</span>
            </div>
            {timeline.keyframes.length === 0 ? (
              <p className="text-[10px] text-zinc-500">No keyframes in this timeline.</p>
            ) : (
              <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto pr-1">
                {timeline.keyframes.map((keyframe) => {
                  const isActive = keyframe.id === activeKeyframe?.id;
                  return (
                    <li key={keyframe.id}>
                      <div
                        className={cn(
                          'flex items-center gap-2 rounded-md border px-2 py-1 transition-colors',
                          isActive
                            ? 'border-studio-accent/50 bg-studio-accent/10'
                            : 'border-obsidian-700/60 bg-obsidian-850/40 hover:border-obsidian-600',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedKeyframeId(keyframe.id)}
                          aria-pressed={isActive}
                          className="flex flex-1 items-center gap-2 rounded text-left text-[11px] text-zinc-200 outline-none focus-visible:ring-1 focus-visible:ring-studio-accent"
                        >
                          <span
                            aria-hidden="true"
                            className={cn('size-1.5 rotate-45', isActive ? 'bg-studio-accent' : 'bg-zinc-600')}
                          />
                          <span className="readout">{keyframe.offset}%</span>
                          <span className="truncate text-zinc-500">
                            {formatMillisecondsAsSeconds((keyframe.offset / 100) * timeline.durationMs)}s ·{' '}
                            {TIMING_PRESET_LABELS[keyframe.timingFunction]}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteKeyframe(keyframe.id)}
                          disabled={timeline.keyframes.length <= 1}
                          aria-label={`Delete keyframe at ${keyframe.offset}%`}
                          className="rounded p-1 text-zinc-600 hover:text-studio-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-accent disabled:pointer-events-none disabled:opacity-30"
                        >
                          <X width={12} height={12} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {project.timelines.length > 1 ? (
            <div className="panel-surface flex flex-col gap-2 p-3">
              <h3 className="text-[10px] tracking-widest text-zinc-500 uppercase">Timelines</h3>
              <ul className="flex flex-col gap-1">
                {project.timelines.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => dispatch((current) => setActiveTimeline(current, entry.id), true)}
                      aria-pressed={entry.id === timeline.id}
                      className={cn(
                        'flex-1 truncate rounded-md border px-2 py-1 text-left text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-studio-accent',
                        entry.id === timeline.id
                          ? 'border-studio-accent/50 bg-studio-accent/10 text-studio-accent'
                          : 'border-obsidian-700/60 text-zinc-400 hover:border-obsidian-600',
                      )}
                    >
                      {entry.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch((current) => removeTimeline(current, entry.id), true)}
                      aria-label={`Remove timeline ${entry.name}`}
                      className="rounded p-1 text-zinc-600 hover:text-studio-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-accent"
                    >
                      <X width={12} height={12} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      <ScrubBar
        scrubber={scrubber}
        durationMs={timeline.durationMs}
        keyframes={timeline.keyframes}
        activeKeyframeId={activeKeyframe?.id ?? null}
        isPlaying={isPlaying}
        onTogglePlayback={engine.toggle}
        onStop={() => {
          engine.stop();
          scrubber.setOffsetPercent(0, true);
        }}
        onStepFrames={engine.stepFrames}
        onSelectKeyframe={setSelectedKeyframeId}
        onKeyframeOffsetChange={onKeyframeOffsetChange}
        onDeleteKeyframe={deleteKeyframe}
      />

      <ExportDrawer
        open={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        timeline={timeline}
        options={exportOptions}
        onOptionsChange={(patch) => setExportOptions((current) => ({ ...current, ...patch }))}
        isExportable={canExport}
      />

      <PresetDrawer
        open={isPresetsOpen}
        onClose={() => setIsPresetsOpen(false)}
        onApply={applyPreset}
        existingTimelineNames={project.timelines.map((entry) => entry.name)}
      />
    </main>
  );
}
