import { useCallback, useEffect, useRef } from 'react';
import type { ComboboxOption } from '../combobox';
import type { AsyncComboboxAction } from './use-async-combobox-state';

export interface AsyncComboboxFetchOptions {
  query: string;
  page: number;
  pageSize: number;
  signal?: AbortSignal;
}

export interface AsyncComboboxFetchResult<T> {
  items: ComboboxOption<T>[];
  hasMore: boolean;
  total?: number;
}

export interface UseAsyncComboboxFetchParams<T extends string | number> {
  fetchOptions: (options: AsyncComboboxFetchOptions) => Promise<AsyncComboboxFetchResult<T>>;
  pageSize: number;
  minQueryLength: number;
  debouncedQuery: string;
  dispatch: React.Dispatch<AsyncComboboxAction<T>>;
}

/**
 * Handles data fetching for async combobox including:
 * - Debounced query handling
 * - Abort controller management
 * - Initial fetch and load more pagination
 * - Error handling
 * 
 * Uses reducer dispatch for better performance by batching state updates.
 */
export function useAsyncComboboxFetch<T extends string | number>({
  fetchOptions,
  pageSize,
  minQueryLength,
  debouncedQuery,
  dispatch,
}: UseAsyncComboboxFetchParams<T>) {
  const abortControllerRef = useRef<AbortController | null>(null);

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
        dispatch({ type: 'SET_LOADING', payload: false });
        dispatch({ type: 'SET_LOADING_MORE', payload: false });
        return;
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      try {
        // Dispatch fetch start - batches loading state updates
        dispatch({ type: 'FETCH_START', payload: { isLoadingMore: isLoadingMoreData } });

        const result = await fetchOptions({
          query: searchQuery,
          page: pageNum,
          pageSize,
          signal: abortControllerRef.current.signal,
        });

        // Dispatch fetch success - batches all success state updates
        dispatch({
          type: 'FETCH_SUCCESS',
          payload: {
            items: result.items,
            hasMore: result.hasMore,
            total: result.total,
            isLoadingMore: isLoadingMoreData,
          },
        });
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        
        // Dispatch fetch error - batches all error state updates
        dispatch({
          type: 'FETCH_ERROR',
          payload: err instanceof Error ? err : new Error('Failed to fetch options'),
        });
      }
    },
    [fetchOptions, pageSize, minQueryLength, dispatch],
  );

  // Effect to fetch data when query changes
  useEffect(() => {
    dispatch({ type: 'RESET_FOR_NEW_QUERY' });
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
