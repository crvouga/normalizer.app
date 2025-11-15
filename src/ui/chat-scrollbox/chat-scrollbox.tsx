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
   * Dependencies to watch for changes that should trigger auto-scroll.
   * When these values change, the scroll position will be evaluated.
   */
  scrollTriggers?: unknown[];
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
  scrollTriggers = [],
  onScrollPositionChange,
  bottomPadding = 'pb-56 md:pb-64',
}: ChatScrollBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const lastScrollTopRef = useRef<number>(0);
  const userScrollTimeoutRef = useRef<number | null>(null);
  const isInitialMountRef = useRef<boolean>(true);

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
   * Auto-scroll when content changes, but only if user is near bottom
   * If user is near bottom, smoothly scroll to bottom when new content arrives
   * This prevents auto-scroll when user has scrolled up to read old messages
   */
  useEffect(() => {
    // Skip on initial mount (handled by separate effect above)
    if (!autoScroll || isInitialMountRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    let timeoutId: number | null = null;
    let rafId: number | null = null;

    // Use requestAnimationFrame to ensure DOM has updated
    rafId = requestAnimationFrame(() => {
      const shouldScroll = checkScrollPosition();

      // If user is near bottom, always auto-scroll smoothly when new content arrives
      // Only skip if user is actively scrolling AWAY from bottom (scrolling up while not near bottom)
      const isScrollingAway = isUserScrolling && !shouldScroll;

      if (shouldScroll && !isScrollingAway) {
        // Small delay to ensure content is fully rendered
        timeoutId = window.setTimeout(() => {
          scrollToBottom();
        }, 50);
      }
    });

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [autoScroll, scrollTriggers, checkScrollPosition, isUserScrolling, scrollToBottom]);

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
