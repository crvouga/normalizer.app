import { useCallback } from 'react';
import { useInfiniteScrollLoader } from '../../lib/use-infinite-scroll-loader';
import { trpcClient } from '../../shared/trpc-client';
import type { UserId } from '../../users/user-id';
import { WorkspacePayload } from '../workspace-payload/workspace-payload';
import { useAddWorkspacePayloadToStore } from '../workspace-payload/workspace-payload-store';

/**
 * Hook for loading workspace projections by user ID with infinite scroll support.
 *
 * @param userId - The user ID to fetch workspaces for
 * @returns Loading state, hasMore flag, loadMore function, and loadMoreRef for infinite scroll
 */
export function useWorkspacesByUserLoader(userId: UserId) {
  const addToStore = useAddWorkspacePayloadToStore();

  const loadData = useCallback(
    async (cursor: string | undefined, limit: number) => {
      const response = await trpcClient.workspace.list.listByStartedByUser.mutate({
        userId,
        cursor,
        limit,
      });
      const payload = WorkspacePayload.schema.parse(response.payload);
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
