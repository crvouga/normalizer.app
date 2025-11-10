import { useCallback, useEffect, useState } from 'react';
import { trpcClient } from '../../trpc-client';
import { useEntityStore } from '../../store/entity-store';
import type { UserId } from '../../users/user-id';
import type { NormalizationSessionProjection } from '../normalization-session-projection';

type LoadingState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'loading-more' }
  | { type: 'loaded' }
  | { type: 'error'; error: Error };

interface UseNormalizationSessionListLoaderResult {
  state: LoadingState;
  hasMore: boolean;
  loadMore: () => void;
}

/**
 * Hook for loading normalization session projections by user ID with infinite scroll support.
 *
 * @param userId - The user ID to fetch sessions for
 * @returns Loading state, hasMore flag, and loadMore function
 */
export function useNormalizationSessionListLoader(
  userId: UserId,
): UseNormalizationSessionListLoaderResult {
  const [state, setState] = useState<LoadingState>({ type: 'idle' });
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const entityStore = useEntityStore();

  const loadSessions = useCallback(
    async (isLoadingMore: boolean) => {
      setState(isLoadingMore ? { type: 'loading-more' } : { type: 'loading' });

      try {
        const response = await trpcClient.normalizationSession.list.listByStartedByUser.mutate({
          userId,
          cursor: isLoadingMore ? (cursor ?? undefined) : undefined,
          limit: 20,
        });

        // Type guard and cast response
        if (
          !response ||
          typeof response !== 'object' ||
          !('sessions' in response) ||
          !('nextCursor' in response) ||
          !('hasMore' in response) ||
          !Array.isArray(response.sessions) ||
          typeof response.hasMore !== 'boolean'
        ) {
          throw new Error('Invalid response from server');
        }

        const typedResponse = response as {
          sessions: NormalizationSessionProjection[];
          nextCursor: string | null;
          hasMore: boolean;
        };

        // Store projections in entity store
        entityStore.addManyEntities('normalizationSessionProjections', typedResponse.sessions);

        // Update cursor and hasMore state
        setCursor(typedResponse.nextCursor);
        setHasMore(typedResponse.hasMore);
        setState({ type: 'loaded' });
      } catch (error) {
        setState({
          type: 'error',
          error:
            error instanceof Error ? error : new Error('Failed to load normalization sessions'),
        });
      }
    },
    [userId, cursor, entityStore],
  );

  // Initial load
  useEffect(() => {
    loadSessions(false);
  }, [userId]); // Only re-run when userId changes

  const loadMore = useCallback(() => {
    if (hasMore && state.type !== 'loading' && state.type !== 'loading-more') {
      loadSessions(true);
    }
  }, [hasMore, state.type, loadSessions]);

  return {
    state,
    hasMore,
    loadMore,
  };
}
