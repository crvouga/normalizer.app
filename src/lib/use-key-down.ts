import { useEffect } from 'react';

/**
 * Hook to listen for key down events
 * @param key - The key to listen for (e.g., 'Escape', 'Enter', 'ArrowDown')
 * @param callback - The function to call when the key is pressed
 */
export const useKeyDown = (key: string, callback: () => void) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === key) {
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [key, callback]);
};
