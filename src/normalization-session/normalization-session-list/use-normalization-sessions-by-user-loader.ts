import { useCallback } from 'react';
import { useInfiniteScrollLoader } from '../../lib/use-infinite-scroll-loader';
import { useEntityStore } from '../../store/entity-store';
import { trpcClient } from '../../shared/trpc-client';
import type { UserId } from '../../users/user-id';
import { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';
import { Artifact } from '~/src/artifacts/artifact';

/**
 * Hook for loading normalization session projections by user ID with infinite scroll support.
 *
 * @param userId - The user ID to fetch sessions for
 * @returns Loading state, hasMore flag, loadMore function, and loadMoreRef for infinite scroll
 */
export function useNormalizationSessionsByUserLoader(userId: UserId) {
  const entityStore = useEntityStore();

  const loadData = useCallback(
    async (cursor: string | undefined, limit: number) => {
      const response = await trpcClient.normalizationSession.list.listByStartedByUser.mutate({
        userId,
        cursor,
        limit,
      });
      const projections = response.sessions.flatMap((projection) => {
        const parsed = NormalizationSessionProjection.schema.safeParse(projection);
        return parsed.success ? [parsed.data] : [];
      });
      const artifacts = response.artifacts.flatMap((artifact) => {
        const parsed = Artifact.schema.safeParse(artifact);
        return parsed.success ? [parsed.data] : [];
      });
      entityStore.addManyEntities('normalizationSessionProjections', projections);
      entityStore.addManyEntities('artifacts', artifacts);
      entityStore.addManyEntities('resourceOwnerships', response.resourceOwnerships);

      return {
        nextCursor: response.nextCursor,
        hasMore: response.hasMore,
      };
    },
    [userId, entityStore],
  );

  return useInfiniteScrollLoader({
    loadData,
    pageSize: 20,
    deps: [userId],
  });
}
