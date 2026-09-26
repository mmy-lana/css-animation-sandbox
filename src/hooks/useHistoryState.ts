'use client';

import { useCallback, useMemo, useReducer, useRef } from 'react';

export interface HistoryStateOptions<T> {
  /** Value the stack starts from. */
  initialState: T;
  /** Maximum number of undo entries retained. Defaults to 50. */
  limit?: number;
  /** Change detector; defaults to `Object.is`. */
  isEqual?: (a: T, b: T) => boolean;
}

export type HistoryUpdater<T> = T | ((previous: T) => T);

export interface HistoryOptions {
  /** When false the change stays out of the undo stack. */
  undoable?: boolean;
}

export interface HistoryState<T> {
  /** Current value. */
  state: T;
  /** Applies a change without touching the undo stack — for live previews. */
  preview: (updater: HistoryUpdater<T>) => void;
  /** Applies a change and pushes the previous value onto the undo stack. */
  commit: (updater: HistoryUpdater<T>, options?: HistoryOptions) => void;
  /**
   * Opens a gesture. Values applied while a gesture is open are transient; the
   * value captured here is pushed onto the undo stack by {@link endGesture},
   * so a whole drag gesture collapses into a single undo entry.
   */
  beginGesture: () => void;
  /** Closes a gesture, recording one history entry if the value changed. */
  endGesture: () => void;
  /** True while a gesture is open. */
  isGesturing: boolean;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Number of retained undo entries, for UI counters. */
  undoDepth: number;
  redoDepth: number;
  /** Replaces the value and clears the history (used by storage hydration). */
  replace: (next: T) => void;
  /** Clears the value and the history back to the initial state. */
  clear: () => void;
}

interface HistoryInternal<T> {
  present: T;
  past: T[];
  future: T[];
  /** Value captured by `beginGesture`, or `null` when no gesture is open. */
  gestureBase: T | null;
}

type HistoryAction<T> =
  | { type: 'preview'; next: T; isEqual: (a: T, b: T) => boolean }
  | { type: 'commit'; next: T; limit: number; undoable: boolean; isEqual: (a: T, b: T) => boolean }
  | { type: 'begin-gesture' }
  | { type: 'end-gesture'; limit: number; isEqual: (a: T, b: T) => boolean }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'replace'; next: T; isEqual: (a: T, b: T) => boolean }
  | { type: 'clear'; initial: T };

function pushLimited<T>(past: T[], entry: T, limit: number): T[] {
  const next = [...past, entry];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

function historyReducer<T>(state: HistoryInternal<T>, action: HistoryAction<T>): HistoryInternal<T> {
  switch (action.type) {
    case 'preview':
      if (action.isEqual(state.present, action.next)) return state;
      return { ...state, present: action.next };

    case 'commit': {
      if (action.isEqual(state.present, action.next)) return state;
      const base = state.gestureBase ?? state.present;
      return {
        present: action.next,
        past: action.undoable ? pushLimited(state.past, base, action.limit) : state.past,
        future: [],
        gestureBase: state.gestureBase,
      };
    }

    case 'begin-gesture':
      return state.gestureBase === null ? { ...state, gestureBase: state.present } : state;

    case 'end-gesture': {
      const base = state.gestureBase;
      if (base === null) return state;
      if (action.isEqual(base, state.present)) return { ...state, gestureBase: null };
      return {
        present: state.present,
        past: pushLimited(state.past, base, action.limit),
        future: [],
        gestureBase: null,
      };
    }

    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        present: previous,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future],
        gestureBase: null,
      };
    }

    case 'redo': {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        present: next,
        past: pushLimited(state.past, state.present, state.past.length + 1),
        future: rest,
        gestureBase: null,
      };
    }

    case 'replace':
      return action.isEqual(state.present, action.next)
        ? { ...state, gestureBase: null }
        : { present: action.next, past: [], future: [], gestureBase: null };

    case 'clear':
      return { present: action.initial, past: [], future: [], gestureBase: null };

    default:
      return state;
  }
}

/**
 * Immutable undo/redo over a single value, with gesture transactions.
 *
 * The inspector writes through `commit` for discrete edits (a number field, a
 * colour pick) and through `beginGesture`/`preview`/`endGesture` for continuous
 * interactions (a keyframe drag, a gizmo rotation), so one gesture produces
 * exactly one undo entry. A commit issued while a gesture is open is folded
 * into the same entry instead of nesting a second one.
 */
export function useHistoryState<T>({
  initialState,
  limit = 50,
  isEqual = Object.is,
}: HistoryStateOptions<T>): HistoryState<T> {
  const [state, dispatch] = useReducer(historyReducer<T>, undefined, (): HistoryInternal<T> => ({
    present: initialState,
    past: [],
    future: [],
    gestureBase: null,
  }));

  // The updater always resolves against the newest value, never a stale closure.
  const presentRef = useRef(state.present);
  presentRef.current = state.present;

  const resolve = useCallback(
    (updater: HistoryUpdater<T>): T =>
      typeof updater === 'function' ? (updater as (previous: T) => T)(presentRef.current) : updater,
    [],
  );

  const preview = useCallback(
    (updater: HistoryUpdater<T>) => dispatch({ type: 'preview', next: resolve(updater), isEqual }),
    [isEqual, resolve],
  );

  const commit = useCallback(
    (updater: HistoryUpdater<T>, options?: HistoryOptions) => {
      dispatch({
        type: 'commit',
        next: resolve(updater),
        limit,
        undoable: options?.undoable !== false,
        isEqual,
      });
    },
    [isEqual, limit, resolve],
  );

  const beginGesture = useCallback(() => dispatch({ type: 'begin-gesture' }), []);
  const endGesture = useCallback(() => dispatch({ type: 'end-gesture', limit, isEqual }), [isEqual, limit]);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const replace = useCallback((next: T) => dispatch({ type: 'replace', next, isEqual }), [isEqual]);
  const clear = useCallback(() => dispatch({ type: 'clear', initial: initialState }), [initialState]);

  return useMemo(
    () => ({
      state: state.present,
      preview,
      commit,
      beginGesture,
      endGesture,
      isGesturing: state.gestureBase !== null,
      undo,
      redo,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      undoDepth: state.past.length,
      redoDepth: state.future.length,
      replace,
      clear,
    }),
    [
      beginGesture,
      clear,
      commit,
      endGesture,
      preview,
      redo,
      replace,
      state.future.length,
      state.gestureBase,
      state.past.length,
      state.present,
      undo,
    ],
  );
}
