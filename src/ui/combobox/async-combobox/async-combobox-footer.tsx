import type { RefObject } from 'react';
import { IconSpinner } from '../../icons';

export interface AsyncComboboxFooterProps {
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreRef: RefObject<HTMLDivElement>;
}

/**
 * Footer component for async combobox with infinite scroll.
 * Displays loading indicator when fetching more items.
 */
export function AsyncComboboxFooter({
  hasMore,
  isLoadingMore,
  loadMoreRef,
}: AsyncComboboxFooterProps) {
  if (!hasMore) return null;

  return (
    <div
      ref={loadMoreRef}
      className="relative cursor-default py-2 pr-9 pl-3 text-center select-none"
    >
      {isLoadingMore ? (
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <IconSpinner />
          <span className="text-xs">Loading more...</span>
        </div>
      ) : (
        <div className="h-2" />
      )}
    </div>
  );
}
