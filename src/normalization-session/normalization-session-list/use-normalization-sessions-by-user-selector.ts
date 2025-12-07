import { useMemo } from 'react';
import { useEntityStoreSelector } from '../../store/entity-store';
import type { UserId } from '../../users/user-id';
import type { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';

/**
 * Hook for selecting normalization session projections from the entity store by user ID.
 *
 * @param userId - The user ID to filter sessions by
 * @returns Array of normalization session projections for the user
 */
export function useNormalizationSessionsByUserSelector(
  userId: UserId,
): NormalizationSessionProjection[] {
  // Get session IDs from the index with shallow equality check
  const sessionIds = useEntityStoreSelector(
    (state) => state.indexes.indexNormalizationSessionProjectionsByUserId[userId] || [],
  );

  // Get the projections byId object with shallow equality check
  const projectionsById = useEntityStoreSelector(
    (state) => state.entities.normalizationSessionProjections.byId,
  );

  // Memoize the derived list of sessions so we don't recompute unnecessarily
  const sessions: NormalizationSessionProjection[] = useMemo(() => {
    return sessionIds
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
  }, [sessionIds, projectionsById]);

  return sessions;
}
