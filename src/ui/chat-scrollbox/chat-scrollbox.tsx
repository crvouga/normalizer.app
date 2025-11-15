import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';

export interface ChatScrollBoxProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /**
   * Whether to automatically scroll to bottom when content changes.
   * Default: true
   */
  autoScroll?: boolean;
  /**
   * Threshold in pixels from bottom to consider user "at bottom".
   * If user scrolls within this threshold, auto-scroll will be enabled.
   * Default: 100
   */
  scrollThreshold?: number;
  /**
   * Smooth scroll behavior. Set to false for instant scrolling.
   * Default: true
   */
  smoothScroll?: boolean;
  /**
   * A key that changes when content should trigger a scroll.
   * When this value changes, the scrollbox will check if it should scroll to bottom.
   * Can be a string, number, or any value that changes when new content is added.
   * This is optional - ResizeObserver will also detect content changes automatically.
   */
  scrollKey?: string | number;
  /**
   * Callback fired when scroll position changes significantly.
   * Useful for showing/hiding scroll-to-bottom buttons.
   */
  onScrollPositionChange?: (isNearBottom: boolean) => void;
  /**
   * Additional padding at the bottom to prevent content cutoff.
   * Can be a Tailwind class or inline style value.
   */
  bottomPadding?: string;
}

/**
 * A robust and reusable chat scrollbox component that handles:
 * - Auto-scrolling to bottom when new content is added
 * - Detecting if user has scrolled up (prevents auto-scroll if reading old messages)
 * - Smooth scrolling behavior
 * - Scroll position tracking
 */
export function ChatScrollBox({
  children,
  className = '',
  contentClassName = '',
  autoScroll = true,
  scrollThreshold = 100,
  smoothScroll = true,
  scrollKey,
  onScrollPositionChange,
  bottomPadding = 'pb-56 md:pb-64',
}: ChatScrollBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const lastScrollTopRef = useRef<number>(0);
  const userScrollTimeoutRef = useRef<number | null>(null);
  const isInitialMountRef = useRef<boolean>(true);
  const lastHeightRef = useRef<number>(0);

  /**
   * Check if user is near the bottom of the scroll container
   */
  const checkScrollPosition = useCallback(() => {
    const container = containerRef.current;
    if (!container) return false;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceFromBottom <= scrollThreshold;

    return nearBottom;
  }, [scrollThreshold]);

  /**
   * Scroll to bottom with smooth or instant behavior
   */
  const scrollToBottom = useCallback(
    (force = false, instant = false) => {
      const container = containerRef.current;
      if (!container) return;

      // If user is actively scrolling up, don't auto-scroll unless forced
      if (!force && isUserScrolling && !isNearBottom) {
        return;
      }

      const maxScroll = container.scrollHeight;
      const useSmoothScroll = smoothScroll && !instant;

      // Use scrollTo for smooth scrolling or scrollTop for instant
      if (useSmoothScroll) {
        container.scrollTo({
          top: maxScroll,
          behavior: 'smooth',
        });
      } else {
        container.scrollTop = maxScroll;
      }
    },
    [smoothScroll, isUserScrolling, isNearBottom],
  );

  /**
   * Handle scroll events to detect user scrolling
   */
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;
    const nearBottom = checkScrollPosition();

    // Detect if user is actively scrolling (not programmatic scroll)
    const isScrollingUp = currentScrollTop < lastScrollTopRef.current;
    const isScrollingDown = currentScrollTop > lastScrollTopRef.current;

    if (isScrollingUp || isScrollingDown) {
      setIsUserScrolling(true);

      // Clear existing timeout
      if (userScrollTimeoutRef.current) {
        window.clearTimeout(userScrollTimeoutRef.current);
      }

      // Reset user scrolling flag after scroll stops
      userScrollTimeoutRef.current = window.setTimeout(() => {
        setIsUserScrolling(false);
      }, 150);
    }

    lastScrollTopRef.current = currentScrollTop;

    // Update near-bottom state
    if (nearBottom !== isNearBottom) {
      setIsNearBottom(nearBottom);
      onScrollPositionChange?.(nearBottom);
    }
  }, [checkScrollPosition, isNearBottom, onScrollPositionChange]);

  /**
   * Attempt to scroll to bottom if conditions are met
   * This is called both by scrollKey changes and ResizeObserver
   */
  const attemptAutoScroll = useCallback(() => {
    if (!autoScroll || isInitialMountRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    const shouldScroll = checkScrollPosition();
    const isScrollingAway = isUserScrolling && !shouldScroll;

    if (shouldScroll && !isScrollingAway) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        // Small delay to ensure content is fully rendered
        window.setTimeout(() => {
          scrollToBottom();
        }, 50);
      });
    }
  }, [autoScroll, checkScrollPosition, isUserScrolling, scrollToBottom]);

  /**
   * Initial mount: scroll to bottom instantly (no animation)
   * Uses double RAF to ensure content is fully rendered before scrolling
   */
  useEffect(() => {
    if (!autoScroll || !isInitialMountRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    let rafId1: number | null = null;
    let rafId2: number | null = null;
    let timeoutId: number | null = null;

    // Use double requestAnimationFrame to ensure DOM is fully updated
    rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(() => {
        // Small timeout to ensure all content is rendered, then scroll instantly
        timeoutId = window.setTimeout(() => {
          container.scrollTop = container.scrollHeight;
          isInitialMountRef.current = false;
        }, 0);
      });
    });

    return () => {
      if (rafId1 !== null) {
        cancelAnimationFrame(rafId1);
      }
      if (rafId2 !== null) {
        cancelAnimationFrame(rafId2);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [autoScroll]);

  /**
   * Auto-scroll when scrollKey changes
   * This provides explicit control over when to check for scrolling
   */
  useEffect(() => {
    if (!autoScroll || isInitialMountRef.current || scrollKey === undefined) return;

    attemptAutoScroll();
  }, [autoScroll, scrollKey, attemptAutoScroll]);

  /**
   * Auto-detect content changes via ResizeObserver
   * This provides automatic scrolling when content height changes,
   * regardless of whether scrollKey is provided.
   * Works independently to catch any DOM changes.
   */
  useEffect(() => {
    if (!autoScroll || isInitialMountRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    // Initialize last height
    lastHeightRef.current = container.scrollHeight;

    const resizeObserver = new ResizeObserver(() => {
      const currentHeight = container.scrollHeight;

      // Only trigger if height actually increased (new content added, not removed)
      // This prevents scrolling when content shrinks
      if (currentHeight > lastHeightRef.current) {
        attemptAutoScroll();
      }

      lastHeightRef.current = currentHeight;
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [autoScroll, attemptAutoScroll]);

  /**
   * Cleanup timeouts on unmount
   */
  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) {
        window.clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`flex w-full flex-1 flex-col overflow-y-scroll ${className}`}
    >
      <div className={`mx-auto flex w-full flex-col ${contentClassName} ${bottomPadding}`}>
        {children}
      </div>
    </div>
  );
}
