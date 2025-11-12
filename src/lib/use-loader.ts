import { useEffect, useState } from 'react';
import type { RemoteResult } from './result';
import { NotAsked, Loading, Success, Failure } from './result';

export interface UseLoaderParams<TData, TDeps extends readonly unknown[]> {
  /**
   * Function to load data
   * @returns Promise with the data to be returned in Success state
   */
  loadData: () => Promise<TData>;

  /**
   * Dependencies that should trigger a reload
   * Similar to useEffect dependencies
   */
  deps: TDeps;

  /**
   * Whether to start loading immediately on mount
   * @default true
   */
  autoLoad?: boolean;
}

export interface UseLoaderResult<TData> {
  state: RemoteResult<TData, Error>;
  reload: () => void;
}

/**
 * A reusable hook for loading data with remote state management.
 *
 * Handles:
 * - Loading state management (NotAsked, Loading, Success, Failure)
 * - Automatic cleanup on unmount
 * - Dependency-based reloads
 * - Manual reload capability
 *
 * @example
 * ```tsx
 * const { state, reload } = useLoader({
 *   loadData: async () => {
 *     const events = await api.getEvents(sessionId);
 *     const eventsWithDates = events.map(e => ({
 *       ...e,
 *       created_at: new Date(e.created_at)
 *     }));
 *     entityStore.addManyEntities('events', eventsWithDates);
 *   },
 *   deps: [sessionId],
 * });
 * ```
 */
export function useLoader<TData, TDeps extends readonly unknown[]>({
  loadData,
  deps,
  autoLoad = true,
}: UseLoaderParams<TData, TDeps>): UseLoaderResult<TData> {
  const [state, setState] = useState<RemoteResult<TData, Error>>(NotAsked);

  const load = async () => {
    setState(Loading);

    try {
      const data = await loadData();
      setState(Success(data));
    } catch (error) {
      setState(Failure(error instanceof Error ? error : new Error('Failed to load data')));
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const loadWithCancellation = async () => {
      setState(Loading);

      try {
        const data = await loadData();
        if (isCancelled) return;
        setState(Success(data));
      } catch (error) {
        if (isCancelled) return;
        setState(Failure(error instanceof Error ? error : new Error('Failed to load data')));
      }
    };

    if (autoLoad) {
      loadWithCancellation();
    }

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    state,
    reload: load,
  };
}
