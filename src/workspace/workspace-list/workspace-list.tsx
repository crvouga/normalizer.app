import type { UserId } from '../../users/user-id';
import type { WorkspaceId } from '../workspace-id';
import { useWorkspacesByUserLoader } from './use-workspaces-by-user-loader';
import { useWorkspacesByUserSelector } from './use-workspaces-by-user-selector';
import { WorkspaceListError } from './ui/workspace-list-error';
import { WorkspaceListLoading } from './ui/workspace-list-loading';
import { WorkspaceListEmpty } from './ui/workspace-list-empty';
import { WorkspaceListLoaded } from './ui/workspace-list-loaded';

interface WorkspaceProjectionListProps {
  userId: UserId;
  onSessionClick: (id: WorkspaceId) => void;
  isSelected: (id: WorkspaceId) => boolean;
}

/**
 * Infinite scroll list of workspaces for a specific user.
 * Loads workspaces on mount and as the user scrolls.
 */
export function WorkspaceProjectionList({
  userId,
  onSessionClick,
  isSelected,
}: WorkspaceProjectionListProps) {
  const { state, hasMore, loadMoreRef, retry } = useWorkspacesByUserLoader(userId);
  const sessions = useWorkspacesByUserSelector(userId);

  if (state.type === 'error') {
    return <WorkspaceListError error={state.error} onRetry={retry} />;
  }

  if (state.type === 'loading' && sessions.length === 0) {
    return <WorkspaceListLoading />;
  }

  if (state.type === 'loaded' && sessions.length === 0) {
    return <WorkspaceListEmpty />;
  }

  return (
    <WorkspaceListLoaded
      sessions={sessions}
      onSessionClick={onSessionClick}
      isSelected={isSelected}
      hasMore={hasMore}
      isLoadingMore={state.type === 'loading-more'}
      loadMoreRef={loadMoreRef}
    />
  );
}
