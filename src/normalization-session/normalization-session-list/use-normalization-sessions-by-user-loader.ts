import { useCallback } from 'react';
import { useInfiniteScrollLoader } from '../../lib/use-infinite-scroll-loader';
import { useEntityStore } from '../../store/entity-store';
import { trpcClient } from '../../trpc-client';
import type { UserId } from '../../users/user-id';
import type { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';
import type { Artifact } from '~/src/artifacts/artifact';

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

      const artifacts: Artifact[] = response.artifacts.map(
        (artifact): Artifact => ({
          ...artifact,
          created_at: artifact.created_at ? new Date(artifact.created_at) : null,
          updated_at: artifact.updated_at ? new Date(artifact.updated_at) : null,
          download_url_expires_at: artifact.download_url_expires_at
            ? new Date(artifact.download_url_expires_at)
            : null,
          upload_url_expires_at: artifact.upload_url_expires_at
            ? new Date(artifact.upload_url_expires_at)
            : null,
        }),
      );
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
