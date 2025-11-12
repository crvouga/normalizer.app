import { useCallback, useEffect, useRef } from 'react';
import type { ComboboxOption } from '../combobox';
import type { AsyncComboboxAction } from './use-async-combobox-state';
import { generateSearchHash } from './generate-search-hash';

export interface AsyncComboboxFetchOptions {
  query: string;
  page: number;
  pageSize: number;
  signal?: AbortSignal;
}

export interface AsyncComboboxFetchIdsResult<T> {
  ids: T[];
  hasMore: boolean;
  total?: number;
}

export interface UseAsyncComboboxFetchParams<T extends string | number> {
  fetchIds: (options: AsyncComboboxFetchOptions) => Promise<AsyncComboboxFetchIdsResult<T>>;
  getOptions: (ids: T[]) => ComboboxOption<T>[];
  pageSize: number;
  minQueryLength: number;
  debouncedQuery: string;
  idsBySearchHash: Record<string, T[]>;
  dispatch: React.Dispatch<AsyncComboboxAction<T>>;
}

/**
 * Handles data fetching for async combobox including:
 * - ID caching by search hash
 * - Debounced query handling
 * - Abort controller management
 * - Initial fetch and load more pagination
 * - Separation of data fetching (fetchIds) and data hydration (getOptions)
 * - Error handling
 *
 * Uses reducer dispatch for better performance by batching state updates.
 */
export function useAsyncComboboxFetch<T extends string | number>({
  fetchIds,
  getOptions,
  pageSize,
  minQueryLength,
  debouncedQuery,
  idsBySearchHash,
  dispatch,
}: UseAsyncComboboxFetchParams<T>) {
  const abortControllerRef = useRef<AbortController | null>(null);
  // Use ref to track latest idsBySearchHash without causing re-renders
  const idsBySearchHashRef = useRef(idsBySearchHash);

  // Update ref when idsBySearchHash changes
  useEffect(() => {
    idsBySearchHashRef.current = idsBySearchHash;
  }, [idsBySearchHash]);

  // Fetch function
  const fetchData = useCallback(
    async (searchQuery: string, pageNum: number, isLoadingMoreData = false) => {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Check min query length
      if (searchQuery.length < minQueryLength) {
        dispatch({ type: 'SET_OPTIONS', payload: [] });
        dispatch({ type: 'SET_HAS_MORE', payload: false });
        return;
      }

      // Generate search hash for caching
      const searchHash = generateSearchHash({
        query: searchQuery,
        page: pageNum,
        pageSize,
      });

      // Check if we have cached IDs for this search (use ref to get latest value)
      const cachedIds = idsBySearchHashRef.current[searchHash];
      if (cachedIds) {
        // Hydrate options from cached IDs
        const items = getOptions(cachedIds);
        dispatch({
          type: 'SEARCH_COMPLETED',
          payload: {
            items,
            hasMore: false, // Cached results represent a complete page
            total: items.length,
            isLoadingMore: isLoadingMoreData,
            searchHash,
            ids: cachedIds,
          },
        });
        return;
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      try {
        // Signal search has started - batches loading state updates
        dispatch({ type: 'SEARCH_STARTED', payload: { isLoadingMore: isLoadingMoreData } });

        const result = await fetchIds({
          query: searchQuery,
          page: pageNum,
          pageSize,
          signal: abortControllerRef.current.signal,
        });

        // Hydrate IDs into options
        const items = getOptions(result.ids);

        // Signal search completed successfully - batches all success state updates and caches IDs
        dispatch({
          type: 'SEARCH_COMPLETED',
          payload: {
            items,
            hasMore: result.hasMore,
            ...(result.total !== undefined ? { total: result.total } : {}),
            isLoadingMore: isLoadingMoreData,
            searchHash,
            ids: result.ids,
          },
        });
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        // Signal search failed - batches all error state updates
        dispatch({
          type: 'SEARCH_FAILED',
          payload: err instanceof Error ? err : new Error('Failed to fetch options'),
        });
      }
    },
    [fetchIds, getOptions, pageSize, minQueryLength, dispatch],
  );

  // Effect to fetch data when query changes
  useEffect(() => {
    dispatch({ type: 'NEW_SEARCH_INITIATED' });
    fetchData(debouncedQuery, 0, false);
  }, [debouncedQuery, fetchData, dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { fetchData };
}
