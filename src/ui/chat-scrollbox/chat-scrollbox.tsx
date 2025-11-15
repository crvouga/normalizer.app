import { useEffect, useLayoutEffect, useRef, useState, useCallback, type ReactNode } from 'react';

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

type ScrollMode = 'auto-scroll' | 'user-scroll';

/**
 * A chat scrollbox component that behaves like iMessages:
 * - Starts scrolled to bottom on initial load
 * - Auto-scrolls when new content appears (only in auto-scroll mode)
 * - Respects user scroll - switches to user-scroll mode when user scrolls up
 * - Switches back to auto-scroll mode when user scrolls to bottom
 */
export function ChatScrollBox({
  children,
  className = '',
  contentClassName = '',
  autoScroll = true,
  scrollThreshold = 100,
  scrollKey,
  onScrollPositionChange,
  bottomPadding = 'pb-56 md:pb-64',
}: ChatScrollBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollMode, setScrollMode] = useState<ScrollMode>('auto-scroll');
  const scrollModeRef = useRef<ScrollMode>('auto-scroll');
  const [isNearBottom, setIsNearBottom] = useState(true);
  const lastScrollTopRef = useRef<number>(0);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const lastHeightRef = useRef<number>(0);
  const isInitialMountRef = useRef<boolean>(true);

  /**
   * Check if user is near the bottom of the scroll container
   */
  const checkIsNearBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return false;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom <= scrollThreshold;
  }, [scrollThreshold]);

  /**
   * Scroll to bottom instantly (for initial mount)
   */
  const scrollToBottomInstant = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    isProgrammaticScrollRef.current = true;
    container.scrollTop = container.scrollHeight;
    // Reset flag after scroll completes
    requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false;
    });
  }, []);

  /**
   * Scroll to bottom smoothly (for auto-scroll when new content appears)
   */
  const scrollToBottomSmooth = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    isProgrammaticScrollRef.current = true;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
    // Reset flag after smooth scroll completes (smooth scroll takes ~500ms)
    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 500);
  }, []);

  /**
   * Handle scroll events to detect user scrolling and update mode
   */
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Ignore programmatic scrolls
    if (isProgrammaticScrollRef.current) {
      lastScrollTopRef.current = container.scrollTop;
      return;
    }

    const currentScrollTop = container.scrollTop;
    const previousScrollTop = lastScrollTopRef.current;
    const nearBottom = checkIsNearBottom();

    // Detect user scroll direction
    const isScrollingUp = currentScrollTop < previousScrollTop;
    const isScrollingDown = currentScrollTop > previousScrollTop;

    // Update mode based on scroll position
    if (isScrollingUp) {
      // User scrolled up → switch to user-scroll mode
      if (scrollMode !== 'user-scroll') {
        setScrollMode('user-scroll');
        scrollModeRef.current = 'user-scroll';
      }
    } else if (isScrollingDown && nearBottom) {
      // User scrolled down and reached bottom → switch to auto-scroll mode
      if (scrollMode !== 'auto-scroll') {
        setScrollMode('auto-scroll');
        scrollModeRef.current = 'auto-scroll';
      }
    } else if (nearBottom && scrollMode === 'user-scroll') {
      // User is at bottom (might have scrolled via other means) → switch to auto-scroll
      setScrollMode('auto-scroll');
      scrollModeRef.current = 'auto-scroll';
    }

    lastScrollTopRef.current = currentScrollTop;

    // Update near-bottom state
    if (nearBottom !== isNearBottom) {
      setIsNearBottom(nearBottom);
      onScrollPositionChange?.(nearBottom);
    }
  }, [checkIsNearBottom, scrollMode, isNearBottom, onScrollPositionChange]);

  /**
   * Initial mount: scroll to bottom instantly before first paint
   */
  useLayoutEffect(() => {
    if (!autoScroll) return;

    const container = containerRef.current;
    if (!container) return;

    // Scroll to bottom instantly on initial mount

    scrollToBottomInstant();
    isInitialMountRef.current = false;
    setScrollMode('auto-scroll');
    scrollModeRef.current = 'auto-scroll';
  }, [autoScroll, scrollToBottomInstant]);

  /**
   * Auto-scroll when content changes (ResizeObserver)
   * Only scrolls when in auto-scroll mode
   */
  useEffect(() => {
    if (!autoScroll || isInitialMountRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    // Initialize last height
    lastHeightRef.current = container.scrollHeight;

    const resizeObserver = new ResizeObserver(() => {
      const currentHeight = container.scrollHeight;

      // Only auto-scroll if:
      // 1. Content height increased (new content added)
      // 2. We're in auto-scroll mode
      if (currentHeight > lastHeightRef.current && scrollModeRef.current === 'auto-scroll') {
        scrollToBottomSmooth();
      }

      lastHeightRef.current = currentHeight;
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [autoScroll, scrollToBottomSmooth]);

  /**
   * Auto-scroll when scrollKey changes
   * Only scrolls when in auto-scroll mode
   */
  useEffect(() => {
    if (!autoScroll || isInitialMountRef.current || scrollKey === undefined) return;

    if (scrollModeRef.current === 'auto-scroll') {
      scrollToBottomSmooth();
    }
  }, [autoScroll, scrollKey, scrollToBottomSmooth]);

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
