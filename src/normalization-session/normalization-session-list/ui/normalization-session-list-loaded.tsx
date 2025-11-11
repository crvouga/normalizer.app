import type { RefObject } from 'react';
import type { NormalizationSessionId } from '../../normalization-session-id';
import type { NormalizationSessionProjection } from '../../normalization-session-projection';
import { NormalizationSessionListItem } from './normalization-session-list-item';

interface NormalizationSessionListLoadedProps {
  sessions: NormalizationSessionProjection[];
  onSessionClick: (id: NormalizationSessionId) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreRef: RefObject<HTMLDivElement>;
}

/**
 * Loaded state for the normalization session list with infinite scroll support.
 */
export function NormalizationSessionListLoaded({
  sessions,
  onSessionClick,
  hasMore,
  isLoadingMore,
  loadMoreRef,
}: NormalizationSessionListLoadedProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex flex-col gap-2 p-4">
        {sessions.map((session) => (
          <NormalizationSessionListItem
            key={session.id}
            projection={session}
            onClick={onSessionClick}
          />
        ))}

        {/* Infinite scroll sentinel */}
        {hasMore && (
          <div ref={loadMoreRef} className="flex items-center justify-center py-4">
            {isLoadingMore && (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 dark:border-slate-600 dark:border-t-blue-400" />
            )}
          </div>
        )}

        {/* No more results indicator */}
        {!hasMore && sessions.length > 0 && (
          <div className="py-4 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-500">No more sessions</p>
          </div>
        )}
      </div>
    </div>
  );
}
