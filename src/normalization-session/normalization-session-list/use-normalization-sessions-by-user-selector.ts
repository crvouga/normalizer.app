import { useMemo } from 'react';
import { shallowEqual, useEntityStoreSelector } from '../../store/entity-store';
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
    (state) => state.indexes.normalizationSessionProjectionsByUserId[userId] || [],
    shallowEqual,
  );

  // Get the projections byId object with shallow equality check
  const projectionsById = useEntityStoreSelector(
    (state) => state.entities.normalizationSessionProjections.byId,
    shallowEqual,
  );

  // Map IDs to entities with memoization
  const sessions = useMemo(
    () =>
      sessionIds
        .map((id) => projectionsById[id])
        .filter(Boolean) as NormalizationSessionProjection[],
    [sessionIds, projectionsById],
  );

  return sessions;
}
