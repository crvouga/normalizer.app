import { useState } from 'react';
import type { ComboboxOption } from '../combobox';

/**
 * Manages the state for an async combobox including:
 * - Query string
 * - Options list
 * - Loading states (initial and load more)
 * - Error state
 * - Pagination state (page, hasMore, total)
 */
export function useAsyncComboboxState<T extends string | number>() {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<ComboboxOption<T>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState<number | undefined>(undefined);

  return {
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
  };
}

