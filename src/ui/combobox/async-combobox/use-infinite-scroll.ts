import { useEffect, useRef } from 'react';

export interface UseInfiniteScrollParams {
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  threshold?: number;
}

/**
 * Manages infinite scroll using Intersection Observer.
 * Returns a ref that should be attached to the load more trigger element.
 */
export function useInfiniteScroll({
  hasMore,
  isLoading,
  isLoadingMore,
  onLoadMore,
  threshold = 0.1,
}: UseInfiniteScrollParams) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore || isLoading || isLoadingMore) {
      return;
    }

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          onLoadMore();
        }
      },
      { threshold },
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoading, isLoadingMore, onLoadMore, threshold]);

  return loadMoreRef;
}
