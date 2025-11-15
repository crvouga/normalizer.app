import { useEffect, useState } from 'react';

/**
 * Hook to get the current scrollbar width in pixels.
 * Useful for compensating layout shifts when scrollbars appear/disappear.
 *
 * @returns The scrollbar width in pixels as a string (e.g., "14px" or "0px")
 *
 * @example
 * ```tsx
 * const scrollbarWidth = useScrollbarWidth();
 * <div style={{ paddingRight: scrollbarWidth }}>
 *   Content that needs to account for scrollbar
 * </div>
 * ```
 */
export function useScrollbarWidth(): string {
  const [scrollbarWidth, setScrollbarWidth] = useState<string>('0px');

  useEffect(() => {
    // Function to measure scrollbar width
    const measureScrollbarWidth = (): number => {
      // Create a temporary div to measure scrollbar width
      const outer = document.createElement('div');
      outer.style.visibility = 'hidden';
      outer.style.overflow = 'scroll';
      // @ts-expect-error - msOverflowStyle is a vendor-prefixed property for IE
      outer.style.msOverflowStyle = 'scrollbar';
      outer.style.position = 'absolute';
      outer.style.width = '100px';
      outer.style.height = '100px';
      document.body.appendChild(outer);

      // Create inner div
      const inner = document.createElement('div');
      inner.style.width = '100%';
      inner.style.height = '100%';
      outer.appendChild(inner);

      // Calculate scrollbar width
      const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

      // Cleanup
      outer.parentNode?.removeChild(outer);

      return scrollbarWidth;
    };

    // Measure on mount
    const width = measureScrollbarWidth();
    setScrollbarWidth(`${width}px`);

    // Re-measure on window resize (scrollbar width can change)
    const handleResize = () => {
      const width = measureScrollbarWidth();
      setScrollbarWidth(`${width}px`);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return scrollbarWidth;
}
