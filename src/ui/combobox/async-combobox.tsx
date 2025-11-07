import { useCallback, useEffect, useRef, useState } from 'react';
import { IconSpinner } from '../icons';
import type { ComboboxOption, ComboboxProps } from './combobox';
import { Combobox } from './combobox';

// Re-export the base ComboboxOption type as AsyncComboboxOption for backwards compatibility
export type AsyncComboboxOption<T> = ComboboxOption<T>;

export interface AsyncComboboxFetchOptions {
  query: string;
  page: number;
  pageSize: number;
  signal?: AbortSignal;
}

export interface AsyncComboboxFetchResult<T> {
  items: AsyncComboboxOption<T>[];
  hasMore: boolean;
  total?: number;
}

export interface AsyncComboboxProps<T>
  extends Omit<ComboboxProps<T>, 'options' | 'query' | 'onQueryChange' | 'isLoading' | 'error'> {
  // Data fetching
  fetchOptions: (options: AsyncComboboxFetchOptions) => Promise<AsyncComboboxFetchResult<T>>;

  // Async-specific behavior
  debounceMs?: number;
  pageSize?: number;
  minQueryLength?: number;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function AsyncCombobox<T extends string | number>({
  fetchOptions,
  debounceMs = 300,
  pageSize = 20,
  minQueryLength = 0,
  ...comboboxProps
}: AsyncComboboxProps<T>) {
  // State
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<AsyncComboboxOption<T>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState<number | undefined>(undefined);

  const debouncedQuery = useDebounce(query, debounceMs);
  const abortControllerRef = useRef<AbortController | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

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
    [fetchOptions, pageSize, minQueryLength],
  );

  // Effect to fetch data when query changes
  useEffect(() => {
    setPage(0);
    fetchData(debouncedQuery, 0, false);
  }, [debouncedQuery, fetchData]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!hasMore || isLoading || isLoadingMore) {
      return;
    }

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchData(debouncedQuery, nextPage, true);
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoading, isLoadingMore, page, debouncedQuery, fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Custom empty state renderer that respects minQueryLength
  const renderEmpty = useCallback(
    (q: string) => {
      // Use custom renderEmpty if provided
      if (comboboxProps.renderEmpty) {
        return comboboxProps.renderEmpty(q);
      }

      if (q.length < minQueryLength) {
        return (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            Type at least {minQueryLength} character{minQueryLength !== 1 ? 's' : ''} to search
          </div>
        );
      }

      return null; // Use default from base Combobox
    },
    [comboboxProps.renderEmpty, minQueryLength],
  );

  // Custom footer for infinite scroll
  const renderFooter = useCallback(() => {
    if (!hasMore) return null;

    return (
      <div
        ref={loadMoreRef}
        className="relative cursor-default py-2 pr-9 pl-3 text-center select-none"
      >
        {isLoadingMore ? (
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <IconSpinner />
            <span className="text-xs">Loading more...</span>
          </div>
        ) : (
          <div className="h-2" />
        )}
      </div>
    );
  }, [hasMore, isLoadingMore]);

  return (
    <>
      <Combobox
        {...comboboxProps}
        options={options}
        query={query}
        onQueryChange={setQuery}
        isLoading={isLoading}
        error={fetchError}
        renderEmpty={renderEmpty}
        renderFooter={renderFooter}
      />

      {/* Optional: Show total count */}
      {total !== undefined && !fetchError && !isLoading && (
        <p className="mt-1 text-xs text-gray-500">
          {total} {total === 1 ? 'result' : 'results'}
        </p>
      )}
    </>
  );
}
