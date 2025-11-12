import { useCallback } from 'react';
import { useInfiniteScrollLoader } from '../../lib/use-infinite-scroll-loader';
import { useEntityStore } from '../../store/entity-store';
import { trpcClient } from '../../trpc-client';
import type { UserId } from '../../users/user-id';
import type { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';

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

      // Convert string dates to Date objects and store projections in entity store
      const sessionsWithDates: NormalizationSessionProjection[] = response.sessions.map(
        (session) => ({
          ...session,
          startedAt: new Date(session.startedAt),
        }),
      );
      entityStore.addManyEntities('normalizationSessionProjections', sessionsWithDates);

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
