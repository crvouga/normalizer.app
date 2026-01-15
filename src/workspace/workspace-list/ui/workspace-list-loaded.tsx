import type { RefObject } from 'react';
import type { WorkspaceId } from '../../workspace-id';
import type { WorkspaceProjection } from '../../workspace-projection/workspace-projection';
import { WorkspaceListItem } from './workspace-list-item';
import { Spinner } from '~/src/ui/spinner';
import { Typography } from '~/src/ui/typography';
import { toI18nText } from '~/src/i18n/types';

interface WorkspaceListLoadedProps {
  sessions: WorkspaceProjection[];
  onSessionClick: (id: WorkspaceId) => void;
  isSelected: (id: WorkspaceId) => boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreRef: RefObject<HTMLDivElement | null>;
}

/**
 * Loaded state for the workspace list with infinite scroll support.
 */
export function WorkspaceListLoaded({
  sessions,
  onSessionClick,
  isSelected,
  hasMore,
  isLoadingMore,
  loadMoreRef,
}: WorkspaceListLoadedProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex flex-col gap-2 p-4">
        {sessions.map((session: WorkspaceProjection) => (
          <WorkspaceListItem
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
            <Typography
              variant="xs"
              color="muted"
              as="p"
              className="text-center"
              text={toI18nText('No more sessions')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
