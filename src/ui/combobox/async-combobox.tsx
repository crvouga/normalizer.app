import { useCallback } from 'react';
import type { ComboboxOption, ComboboxProps } from './combobox';
import { Combobox } from './combobox';
import { AsyncComboboxEmptyState } from './async-combobox/async-combobox-empty-state';
import { AsyncComboboxFooter } from './async-combobox/async-combobox-footer';
import { AsyncComboboxTotalCount } from './async-combobox/async-combobox-total-count';
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

  // Action button
  actionButton?: React.ReactNode;
}

export function AsyncCombobox<T extends string | number>({
  fetchOptions,
  debounceMs = 300,
  pageSize = 20,
  minQueryLength = 0,
  actionButton,
  ...comboboxProps
}: AsyncComboboxProps<T>) {
  // Use reducer for better performance - single state object reduces re-renders
  const { state, dispatch } = useAsyncComboboxState<T>();
  const { query, options, isLoading, isLoadingMore, fetchError, page, hasMore, total } = state;

  const debouncedQuery = useDebounce(query, debounceMs);

  const { fetchData } = useAsyncComboboxFetch({
    fetchOptions,
    pageSize,
    minQueryLength,
    debouncedQuery,
    dispatch,
  });

  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1;
    dispatch({ type: 'SET_PAGE', payload: nextPage });
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
    <>
      <Combobox
        {...comboboxProps}
        options={options}
        query={query}
        onQueryChange={(newQuery) => dispatch({ type: 'SET_QUERY', payload: newQuery })}
        isLoading={isLoading}
        error={fetchError}
        renderEmpty={renderEmpty}
        renderFooter={renderFooter}
        hasActionButton={Boolean(actionButton)}
        actionButton={actionButton}
      />

      <AsyncComboboxTotalCount total={total} hasError={!!fetchError} isLoading={isLoading} />
    </>
  );
}
