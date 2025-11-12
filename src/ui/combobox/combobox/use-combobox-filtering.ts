import { useMemo } from 'react';
import type { ComboboxOption } from '../combobox-types';

export interface UseComboboxFilteringParams<T> {
  options: ComboboxOption<T>[];
  query: string;
  filterOptions?: (options: ComboboxOption<T>[], query: string) => ComboboxOption<T>[];
}

/**
 * Handles filtering of combobox options based on the current query.
 * If a custom filterOptions function is provided, it will be used.
 * Otherwise, returns all options unfiltered (client-side filtering can be added here).
 */
export function useComboboxFiltering<T extends string | number>({
  options,
  query,
  filterOptions,
}: UseComboboxFilteringParams<T>) {
  const filteredOptions = useMemo(() => {
    if (filterOptions && query) {
      return filterOptions(options, query);
    }
    return options;
  }, [options, query, filterOptions]);

  return {
    filteredOptions,
  };
}
