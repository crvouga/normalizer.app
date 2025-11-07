import { useCallback } from 'react';
import { IconSpinner } from '../icons';
import type { ComboboxOption, ComboboxProps } from './combobox';
import { Combobox } from './combobox';
import { useAsyncComboboxState } from './async-combobox/use-async-combobox-state';
import {
  type AsyncComboboxFetchOptions,
  type AsyncComboboxFetchResult,
  useAsyncComboboxFetch,
} from './async-combobox/use-async-combobox-fetch';
import { useDebounce } from './async-combobox/use-debounce';
import { useInfiniteScroll } from './async-combobox/use-infinite-scroll';

// Re-export the base ComboboxOption type as AsyncComboboxOption for backwards compatibility
export type AsyncComboboxOption<T> = ComboboxOption<T>;

// Re-export types for consumers
export type { AsyncComboboxFetchOptions, AsyncComboboxFetchResult };

export interface AsyncComboboxProps<T>
  extends Omit<ComboboxProps<T>, 'options' | 'query' | 'onQueryChange' | 'isLoading' | 'error'> {
  // Data fetching
  fetchOptions: (options: AsyncComboboxFetchOptions) => Promise<AsyncComboboxFetchResult<T>>;

  // Async-specific behavior
  debounceMs?: number;
  pageSize?: number;
  minQueryLength?: number;
}

export function AsyncCombobox<T extends string | number>({
  fetchOptions,
  debounceMs = 300,
  pageSize = 20,
  minQueryLength = 0,
  ...comboboxProps
}: AsyncComboboxProps<T>) {
  // Use extracted hooks
  const {
    query,
    setQuery,
    options,
    setOptions,
    isLoading,
    setIsLoading,
    isLoadingMore,
    setIsLoadingMore,
    fetchError,
    setFetchError,
    page,
    setPage,
    hasMore,
    setHasMore,
    total,
    setTotal,
  } = useAsyncComboboxState<T>();

  const debouncedQuery = useDebounce(query, debounceMs);

  const { fetchData } = useAsyncComboboxFetch({
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
  });

  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchData(debouncedQuery, nextPage, true);
  }, [page, setPage, fetchData, debouncedQuery]);

  const loadMoreRef = useInfiniteScroll({
    hasMore,
    isLoading,
    isLoadingMore,
    onLoadMore: handleLoadMore,
  });

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
