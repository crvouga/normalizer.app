import { useCallback } from 'react';
import type { ComboboxOption } from '../combobox-types';

export interface UseComboboxDisplayValueParams<T> {
  options: ComboboxOption<T>[];
  displayValue?: (value: T | null) => string;
}

/**
 * Hook to handle display value logic for the combobox input.
 * Converts the selected value to a display string.
 */
export function useComboboxDisplayValue<T extends string | number>({
  options,
  displayValue,
}: UseComboboxDisplayValueParams<T>) {
  const getDisplayValue = useCallback(
    (val: T | null) => {
      if (val === null) return '';
      if (displayValue) return displayValue(val);

      const option = options.find((opt) => opt.value === val);
      return option?.label || String(val);
    },
    [displayValue, options],
  );

  return {
    getDisplayValue,
  };
}
