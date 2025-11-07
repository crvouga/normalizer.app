import { useState } from 'react';

export interface UseComboboxQueryParams {
  controlledQuery?: string;
  onQueryChange?: (query: string) => void;
}

/**
 * Manages query state for combobox, supporting both controlled and uncontrolled modes.
 * When controlledQuery is provided, it acts as a controlled component.
 * Otherwise, it manages its own internal state.
 */
export function useComboboxQuery({ controlledQuery, onQueryChange }: UseComboboxQueryParams) {
  const [internalQuery, setInternalQuery] = useState('');

  // Use controlled query if provided, otherwise use internal state
  const query = controlledQuery !== undefined ? controlledQuery : internalQuery;

  const setQuery = (newQuery: string) => {
    if (onQueryChange) {
      onQueryChange(newQuery);
    } else {
      setInternalQuery(newQuery);
    }
  };

  return {
    query,
    setQuery,
  };
}
