import { useEffect, useState } from 'react';

/**
 * Debounces a value by the specified delay.
 * The debounced value will only update after the specified delay has passed
 * since the last change to the input value.
 */
export function useDebounce<T>(value: T, delay: number): T {
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

