import type { RefObject } from 'react';
import type { NormalizationSessionId } from '../../normalization-session-id';
import type { NormalizationSessionProjection } from '../../normalization-session-projection/normalization-session-projection';
import { NormalizationSessionListItem } from './normalization-session-list-item';
import { Spinner } from '~/src/ui/spinner';
import { Typography } from '~/src/ui/typography';

interface NormalizationSessionListLoadedProps {
  sessions: NormalizationSessionProjection[];
  onSessionClick: (id: NormalizationSessionId) => void;
  isSelected: (id: NormalizationSessionId) => boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreRef: RefObject<HTMLDivElement | null>;
}

/**
 * Loaded state for the normalization session list with infinite scroll support.
 */
export function NormalizationSessionListLoaded({
  sessions,
  onSessionClick,
  isSelected,
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
            isSelected={isSelected(session.id)}
          />
        ))}

        {/* Infinite scroll sentinel */}
        {hasMore && (
          <div ref={loadMoreRef} className="flex items-center justify-center py-4">
            {isLoadingMore && <Spinner size="sm" />}
          </div>
        )}

        {/* No more results indicator */}
        {!hasMore && sessions.length > 0 && (
          <div className="py-4 text-center">
            <Typography variant="xs" color="muted" as="p" className="text-center">
              No more sessions
            </Typography>
          </div>
        )}
      </div>
    </div>
  );
}
