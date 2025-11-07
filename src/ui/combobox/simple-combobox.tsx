import { useCallback } from 'react';
import type { AsyncComboboxOption, AsyncComboboxProps } from './async-combobox';
import { AsyncCombobox } from './async-combobox';
import type { AsyncComboboxFetchOptions, AsyncComboboxFetchResult } from './async-combobox';

// Export a simpler version for common use cases
export interface SimpleComboboxProps<T> extends Omit<AsyncComboboxProps<T>, 'fetchOptions'> {
  options: AsyncComboboxOption<T>[];
  onSearch?: (query: string) => void;
}

export function SimpleCombobox<T extends string | number>({
  options: staticOptions,
  onSearch,
  ...props
}: SimpleComboboxProps<T>) {
  const fetchOptions = useCallback(
    async ({
      query,
      page,
      pageSize,
    }: AsyncComboboxFetchOptions): Promise<AsyncComboboxFetchResult<T>> => {
      // Filter options based on query
      const filtered = staticOptions.filter((option) =>
        option.label.toLowerCase().includes(query.toLowerCase()),
      );

      // Pagination
      const start = page * pageSize;
      const end = start + pageSize;
      const items = filtered.slice(start, end);
      const hasMore = end < filtered.length;

      // Call onSearch if provided
      if (onSearch) {
        onSearch(query);
      }

      return {
        items,
        hasMore,
        total: filtered.length,
      };
    },
    [staticOptions, onSearch],
  );

  return <AsyncCombobox {...props} fetchOptions={fetchOptions} />;
}

