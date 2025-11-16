import { useCallback } from 'react';
import { useInfiniteScrollLoader } from '../../lib/use-infinite-scroll-loader';
import { trpcClient } from '../../shared/trpc-client';
import type { UserId } from '../../users/user-id';
import {
  NormalizationSessionPayload,
  useAddNormalizationSessionPayloadToStore,
} from '../normalization-session-payload';

/**
 * Hook for loading normalization session projections by user ID with infinite scroll support.
 *
 * @param userId - The user ID to fetch sessions for
 * @returns Loading state, hasMore flag, loadMore function, and loadMoreRef for infinite scroll
 */
export function useNormalizationSessionsByUserLoader(userId: UserId) {
  const addToStore = useAddNormalizationSessionPayloadToStore();

  const loadData = useCallback(
    async (cursor: string | undefined, limit: number) => {
      const response = await trpcClient.normalizationSession.list.listByStartedByUser.mutate({
        userId,
        cursor,
        limit,
      });
      const payload = NormalizationSessionPayload.schema.parse(response.payload);
      addToStore(payload);
      return {
        nextCursor: response.nextCursor,
        hasMore: response.hasMore,
      };
    },
    [userId, addToStore],
  );

  return useInfiniteScrollLoader({
    loadData,
    pageSize: 20,
    deps: [userId],
  });
}
