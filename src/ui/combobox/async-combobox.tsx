import { useCallback } from 'react';
import { useInfiniteScroll } from '../../lib/use-infinite-scroll';
import { AsyncComboboxEmptyState } from './async-combobox/async-combobox-empty-state';
import { AsyncComboboxFooter } from './async-combobox/async-combobox-footer';
import {
  type AsyncComboboxFetchIdsResult,
  type AsyncComboboxFetchOptions,
  useAsyncComboboxFetch,
} from './async-combobox/use-async-combobox-fetch';
import { useAsyncComboboxState } from './async-combobox/use-async-combobox-state';
import { useDebounce } from './async-combobox/use-debounce';
import type { ComboboxOption, ComboboxProps } from './combobox';
import { Combobox } from './combobox';

// Re-export the base ComboboxOption type as AsyncComboboxOption for backwards compatibility
export type AsyncComboboxOption<T> = ComboboxOption<T>;

// Re-export types for consumers
export type { AsyncComboboxFetchIdsResult, AsyncComboboxFetchOptions };

export interface AsyncComboboxProps<T>
  extends Omit<ComboboxProps<T>, 'options' | 'query' | 'onQueryChange' | 'isLoading' | 'error'> {
  // Data fetching and hydration
  fetchIds: (options: AsyncComboboxFetchOptions) => Promise<AsyncComboboxFetchIdsResult<T>>;
  getOptions: (ids: T[]) => ComboboxOption<T>[];

  // Async-specific behavior
  debounceMs?: number;
  pageSize?: number;
  minQueryLength?: number;
}

export function AsyncCombobox<T extends string | number>({
  fetchIds,
  getOptions,
  debounceMs = 300,
  pageSize = 20,
  minQueryLength = 0,
  actionButton,
  ...comboboxProps
}: AsyncComboboxProps<T>) {
  // Use reducer for better performance - single state object reduces re-renders
  const { state, dispatch } = useAsyncComboboxState<T>();
  const { query, options, idsBySearchHash, isLoading, isLoadingMore, fetchError, page, hasMore } =
    state;

  const debouncedQuery = useDebounce(query, debounceMs);

  const { fetchData } = useAsyncComboboxFetch({
    fetchIds,
    getOptions,
    pageSize,
    minQueryLength,
    debouncedQuery,
    idsBySearchHash,
    dispatch,
  });

  const handleLoadMore = useCallback(() => {
    dispatch({ type: 'LOAD_MORE_REQUESTED' });
    const nextPage = page + 1;
    fetchData(debouncedQuery, nextPage, true);
  }, [page, dispatch, fetchData, debouncedQuery]);

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

      return <AsyncComboboxEmptyState query={q} minQueryLength={minQueryLength} />;
    },
    [comboboxProps.renderEmpty, minQueryLength],
  );

  // Custom footer for infinite scroll
  const renderFooter = useCallback(
    () => (
      <AsyncComboboxFooter
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        loadMoreRef={loadMoreRef}
      />
    ),
    [hasMore, isLoadingMore, loadMoreRef],
  );

  return (
    <Combobox
      {...comboboxProps}
      options={options}
      query={query}
      onQueryChange={(newQuery) => dispatch({ type: 'SEARCH_QUERY_CHANGED', payload: newQuery })}
      isLoading={isLoading}
      error={fetchError}
      renderEmpty={renderEmpty}
      renderFooter={renderFooter}
      actionButton={actionButton}
    />
  );
}
