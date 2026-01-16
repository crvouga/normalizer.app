import { useMemo } from 'react';
import { useEntityStoreSelector } from '../../store/entity-store';
import type { UserId } from '../../users/user-id';
import type { WorkspaceProjection } from '../workspace-projection/workspace-projection';

/**
 * Hook for selecting workspace projections from the entity store by user ID.
 *
 * @param userId - The user ID to filter workspaces by
 * @returns Array of workspace projections for the user
 */
export function useWorkspacesByUserSelector(userId: UserId): WorkspaceProjection[] {
  // Get workspace IDs from the index with shallow equality check
  const workspaceIds = useEntityStoreSelector(
    (state) => state.indexes.indexWorkspaceProjectionsByUserId[userId] || [],
  );

  // Get the projections byId object with shallow equality check
  const projectionsById = useEntityStoreSelector(
    (state) => state.entities.workspaceProjections.byId,
  );

  // Memoize the derived list of workspaces so we don't recompute unnecessarily
  const sessions: WorkspaceProjection[] = useMemo(() => {
    return workspaceIds
      .flatMap((id) => {
        const projection = projectionsById[id];
        if (!projection) {
          return [];
        }
        return [projection];
      })
      .sort((a, b) => {
        // Sort by startedAt descending (newest first)
        const aTime =
          a.startedAt instanceof Date ? a.startedAt.getTime() : new Date(a.startedAt).getTime();
        const bTime =
          b.startedAt instanceof Date ? b.startedAt.getTime() : new Date(b.startedAt).getTime();
        return bTime - aTime;
      });
  }, [workspaceIds, projectionsById]);

  return sessions;
}
