import { useCallback, useEffect, useRef, useState } from 'react';

type LoadingState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'loading-more' }
  | { type: 'loaded' }
  | { type: 'error'; error: Error };

export interface PaginatedResponse {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface UseInfiniteScrollLoaderParams<TDeps extends readonly unknown[]> {
  /**
   * Function to load and store a page of data
   * @param cursor - The cursor for pagination (undefined for first page)
   * @param limit - Number of items to fetch per page
   * @returns Promise with nextCursor and hasMore flag
   */
  loadData: (cursor: string | undefined, limit: number) => Promise<PaginatedResponse>;

  /**
   * Number of items to fetch per page
   * @default 20
   */
  pageSize?: number;

  /**
   * Intersection Observer threshold
   * @default 0.1
   */
  threshold?: number;

  /**
   * Dependencies that should trigger a reset and reload
   * Similar to useEffect dependencies
   */
  deps: TDeps;
}

export interface UseInfiniteScrollLoaderResult {
  state: LoadingState;
  hasMore: boolean;
  loadMore: () => void;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  retry: () => void;
}

/**
 * A reusable hook for infinite scroll with automatic data loading and pagination.
 *
 * Handles:
 * - Loading state management
 * - Cursor-based pagination
 * - Intersection Observer for automatic loading
 * - Error handling and retry
 * - Dependency-based resets
 *
 * You only need to provide:
 * - A function to load and store data
 * - Dependencies that should trigger a reload
 *
 * @example
 * ```tsx
 * const { state, hasMore, loadMoreRef } = useInfiniteScrollLoader({
 *   loadData: async (cursor, limit) => {
 *     const response = await api.list({ cursor, limit });
 *     const items = response.items.map(item => ({
 *       ...item,
 *       date: new Date(item.date)
 *     }));
 *     entityStore.addManyEntities('sessions', items);
 *     return {
 *       nextCursor: response.nextCursor,
 *       hasMore: response.hasMore,
 *     };
 *   },
 *   deps: [userId],
 * });
 * ```
 */
export function useInfiniteScrollLoader<TDeps extends readonly unknown[]>({
  loadData,
  pageSize = 20,
  threshold = 0.1,
  deps,
}: UseInfiniteScrollLoaderParams<TDeps>): UseInfiniteScrollLoaderResult {
  const [state, setState] = useState<LoadingState>({ type: 'idle' });
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (isLoadingMore: boolean) => {
      setState(isLoadingMore ? { type: 'loading-more' } : { type: 'loading' });

      try {
        const response = await loadData(
          isLoadingMore ? (cursor ?? undefined) : undefined,
          pageSize,
        );

        setCursor(response.nextCursor);
        setHasMore(response.hasMore);
        setState({ type: 'loaded' });
      } catch (error) {
        setState({
          type: 'error',
          error: error instanceof Error ? error : new Error('Failed to load data'),
        });
      }
    },
    [cursor, loadData, pageSize],
  );

  // Reset state when dependencies change
  useEffect(() => {
    setCursor(null);
    setHasMore(false);
    setState({ type: 'idle' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Initial load
  useEffect(() => {
    if (state.type === 'idle') {
      load(false);
    }
  }, [state.type, load]);

  const loadMore = useCallback(() => {
    if (hasMore && state.type !== 'loading' && state.type !== 'loading-more') {
      load(true);
    }
  }, [hasMore, state.type, load]);

  const retry = useCallback(() => {
    if (state.type === 'error') {
      load(cursor !== null);
    }
  }, [state.type, cursor, load]);

  // Setup Intersection Observer
  useEffect(() => {
    if (!hasMore || state.type === 'loading' || state.type === 'loading-more') {
      return;
    }

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { threshold },
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, state.type, loadMore, threshold]);

  return {
    state,
    hasMore,
    loadMore,
    loadMoreRef,
    retry,
  };
}
