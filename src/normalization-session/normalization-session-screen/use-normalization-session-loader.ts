import { useEffect, useState } from 'react';
import { trpcClient } from '../../trpc-client';
import { useEntityStore } from '../../store/entity-store';
import type { NormalizationSessionId } from '../normalization-session-id';
import type { RemoteResult } from '../../lib/result';
import { NotAsked, Loading as RemoteLoading, Success, Failure } from '../../lib/result';

/**
 * Hook for loading normalization session events from the server and storing them in the entity store.
 *
 * @param id - The normalization session ID to load events for
 * @returns The current remote result state (RemoteResult<void, Error>)
 */
export function useNormalizationSessionLoader(
  id: NormalizationSessionId,
): RemoteResult<void, Error> {
  const [state, setState] = useState<RemoteResult<void, Error>>(NotAsked);
  const entityStore = useEntityStore();

  useEffect(() => {
    let isCancelled = false;

    const loadEvents = async () => {
      setState(RemoteLoading);

      try {
        // Fetch events from the server
        const events = await trpcClient.normalizationSession.events.getBySessionId.mutate({
          sessionId: id,
        });

        if (isCancelled) return;

        // Store events in the entity store
        entityStore.addManyEntities('normalizationSessionEvents', events);

        setState(Success(undefined));
      } catch (error) {
        if (isCancelled) return;

        setState(
          Failure(
            error instanceof Error
              ? error
              : new Error('Failed to load normalization session events'),
          ),
        );
      }
    };

    loadEvents();

    return () => {
      isCancelled = true;
    };
  }, [id]);

  return state;
}
