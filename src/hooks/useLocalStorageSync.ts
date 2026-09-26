'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearActiveProject,
  isLocalStorageAvailable,
  loadActiveProject,
  saveActiveProject,
  subscribeToActiveProjectChanges,
  type LoadResult,
  type WriteResult,
} from '@/lib/storage';
import type { ProjectRecord } from '@/types/sandbox';

export interface UseLocalStorageSyncOptions {
  /** Project used before hydration completes, and when storage is empty. */
  initialProject: ProjectRecord;
  /** Debounce window before a change is written. Defaults to 350ms. */
  debounceMs?: number;
  /** Set false to keep the project in memory only. */
  persist?: boolean;
  /** Called once with the storage outcome of the first load. */
  onHydrated?: (result: LoadResult) => void;
}

export type StorageSyncStatus = 'hydrating' | 'idle' | 'saving' | 'saved' | 'error';

export interface LocalStorageSync {
  project: ProjectRecord;
  isHydrated: boolean;
  status: StorageSyncStatus;
  /** Human-readable explanation for the current status, or null. */
  message: string | null;
  /** True when the value is kept in memory because localStorage is unusable. */
  isDegraded: boolean;
  /** True when a migration had to run before the project could be loaded. */
  wasMigrated: boolean;
  lastSavedAt: number | null;
  /** Applies a change; persistence and history stay the caller's business. */
  setProject: (updater: ProjectRecord | ((previous: ProjectRecord) => ProjectRecord)) => void;
  /** Forces an immediate write, cancelling the debounce. */
  flush: () => void;
  /** Re-reads storage, e.g. after a change in another tab. */
  reload: () => void;
  /** Removes the persisted project. */
  reset: () => void;
}

/**
 * Persists the active project to `localStorage`.
 *
 * Writes are debounced and always carry the versioned envelope from
 * `lib/storage`, so a schema change is migrated on read rather than silently
 * dropped. Cross-tab writes arrive through the native `storage` event and are
 * applied without clobbering the local tab, and every failure mode (private
 * mode, quota, malformed JSON) resolves to a status the UI can render instead of
 * throwing.
 */
export function useLocalStorageSync({
  initialProject,
  debounceMs = 350,
  persist = true,
  onHydrated,
}: UseLocalStorageSyncOptions): LocalStorageSync {
  const [project, setProjectState] = useState<ProjectRecord>(initialProject);
  const [isHydrated, setIsHydrated] = useState(false);
  const [status, setStatus] = useState<StorageSyncStatus>('hydrating');
  const [message, setMessage] = useState<string | null>(null);
  const [isDegraded, setIsDegraded] = useState(false);
  const [wasMigrated, setWasMigrated] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const projectRef = useRef(project);
  projectRef.current = project;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<ProjectRecord | null>(null);
  /** Set when a value arrived from storage and must not be written back. */
  const suppressPersistRef = useRef(false);
  const onHydratedRef = useRef(onHydrated);
  onHydratedRef.current = onHydrated;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const applyResult = useCallback((result: WriteResult) => {
    if (result.status === 'ok') {
      setStatus('saved');
      setMessage(result.degraded ? 'Saved in memory only — localStorage is unavailable.' : null);
      setIsDegraded(result.degraded);
      setLastSavedAt(Date.now());
      return;
    }
    setStatus('error');
    setMessage(result.message);
    setIsDegraded(true);
  }, []);

  const write = useCallback(
    (next: ProjectRecord) => {
      pendingRef.current = null;
      if (!persist) {
        setStatus('idle');
        return;
      }
      setStatus('saving');
      applyResult(saveActiveProject(next));
    },
    [applyResult, persist],
  );

  // Hydrate once on mount, on the client only.
  useEffect(() => {
    if (!isLocalStorageAvailable()) setIsDegraded(true);
    const result = loadActiveProject();
    if (result.status === 'ok') {
      suppressPersistRef.current = true;
      setProjectState(result.envelope.project);
      setWasMigrated(result.migratedFrom !== null || result.migrations.length > 0);
      if (result.migratedFrom !== null) {
        setMessage(`Upgraded a project saved with schema v${result.migratedFrom}.`);
      }
    } else if (result.status === 'corrupt') {
      setMessage(result.message);
      setStatus('error');
    }
    setIsHydrated(true);
    onHydratedRef.current?.(result);
    // Runs exactly once: the initial value is the fallback for a fresh session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced persistence for every change after hydration.
  useEffect(() => {
    if (!isHydrated || !persist) return;
    if (suppressPersistRef.current) {
      suppressPersistRef.current = false;
      return;
    }
    if (project === initialProject) return;
    pendingRef.current = project;
    setStatus('saving');
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const pending = pendingRef.current;
      if (pending) write(pending);
    }, debounceMs);
    return clearTimer;
  }, [clearTimer, debounceMs, initialProject, isHydrated, persist, project, write]);

  // Another tab wrote a newer project: adopt it without echoing the write back.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    return subscribeToActiveProjectChanges((change) => {
      if (change.project) {
        suppressPersistRef.current = true;
        setProjectState(change.project);
        setWasMigrated(change.migrated);
        setMessage(change.migrated ? 'A project from another tab needed a schema upgrade.' : null);
      }
      setStatus('idle');
    });
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const setProject = useCallback((updater: ProjectRecord | ((previous: ProjectRecord) => ProjectRecord)) => {
    setProjectState((previous) => (typeof updater === 'function' ? (updater as (p: ProjectRecord) => ProjectRecord)(previous) : updater));
  }, []);

  const flush = useCallback(() => {
    clearTimer();
    if (pendingRef.current) write(pendingRef.current);
  }, [clearTimer, write]);

  const reload = useCallback(() => {
    const result = loadActiveProject();
    if (result.status === 'ok') {
      suppressPersistRef.current = true;
      setProjectState(result.envelope.project);
      setWasMigrated(result.migratedFrom !== null || result.migrations.length > 0);
      setStatus('idle');
      setMessage(null);
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    pendingRef.current = null;
    clearActiveProject();
    setProjectState(initialProject);
    setStatus('idle');
    setMessage(null);
    setLastSavedAt(null);
  }, [clearTimer, initialProject]);

  return useMemo(
    () => ({
      project,
      isHydrated,
      status,
      message,
      isDegraded,
      wasMigrated,
      lastSavedAt,
      setProject,
      flush,
      reload,
      reset,
    }),
    [flush, isDegraded, isHydrated, lastSavedAt, message, project, reload, reset, setProject, status, wasMigrated],
  );
}
