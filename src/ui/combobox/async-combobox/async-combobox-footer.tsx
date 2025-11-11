import type { RefObject } from 'react';
import { Spinner } from '../../spinner';
import { Typography } from '../../typography';

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
        <div className="flex items-center justify-center gap-2">
          <Spinner size="sm" />
          <Typography variant="xs" color="muted">
            Loading more...
          </Typography>
        </div>
      ) : (
        <div className="h-2" />
      )}
    </div>
  );
}
