import { useCallback, useEffect, useRef } from 'react';
import type { ComboboxOption } from '../combobox';

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
  setOptions: (
    options: ComboboxOption<T>[] | ((prev: ComboboxOption<T>[]) => ComboboxOption<T>[]),
  ) => void;
  setIsLoading: (loading: boolean) => void;
  setIsLoadingMore: (loading: boolean) => void;
  setFetchError: (error: Error | null) => void;
  setHasMore: (hasMore: boolean) => void;
  setTotal: (total: number | undefined) => void;
  setPage: (page: number) => void;
}

/**
 * Handles data fetching for async combobox including:
 * - Debounced query handling
 * - Abort controller management
 * - Initial fetch and load more pagination
 * - Error handling
 */
export function useAsyncComboboxFetch<T extends string | number>({
  fetchOptions,
  pageSize,
  minQueryLength,
  debouncedQuery,
  setOptions,
  setIsLoading,
  setIsLoadingMore,
  setFetchError,
  setHasMore,
  setTotal,
  setPage,
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
        setOptions([]);
        setHasMore(false);
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      try {
        if (isLoadingMoreData) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }
        setFetchError(null);

        const result = await fetchOptions({
          query: searchQuery,
          page: pageNum,
          pageSize,
          signal: abortControllerRef.current.signal,
        });

        if (isLoadingMoreData) {
          setOptions((prev) => [...prev, ...result.items]);
        } else {
          setOptions(result.items);
        }

        setHasMore(result.hasMore);
        setTotal(result.total);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setFetchError(err instanceof Error ? err : new Error('Failed to fetch options'));
        setOptions([]);
        setHasMore(false);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [
      fetchOptions,
      pageSize,
      minQueryLength,
      setOptions,
      setIsLoading,
      setIsLoadingMore,
      setFetchError,
      setHasMore,
      setTotal,
    ],
  );

  // Effect to fetch data when query changes
  useEffect(() => {
    setPage(0);
    fetchData(debouncedQuery, 0, false);
  }, [debouncedQuery, fetchData, setPage]);

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
