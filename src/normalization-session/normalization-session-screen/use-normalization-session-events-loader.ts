import { trpcClient } from '../../trpc-client';
import { useEntityStore } from '../../store/entity-store';
import type { NormalizationSessionId } from '../normalization-session-id';
import type { RemoteResult } from '../../lib/result';
import { useLoader } from '../../lib/use-loader';

/**
 * Hook for loading normalization session events from the server and storing them in the entity store.
 *
 * @param id - The normalization session ID to load events for
 * @returns The current remote result state (RemoteResult<void, Error>)
 */
export function useNormalizationSessionEventsLoader(
  id: NormalizationSessionId,
): RemoteResult<void, Error> {
  const entityStore = useEntityStore();

  const { state } = useLoader({
    loadData: async () => {
      // Fetch events from the server
      const events = await trpcClient.normalizationSession.events.getBySessionId.mutate({
        sessionId: id,
      });

      // Convert string dates to Date objects and store events in the entity store
      const eventsWithDates = events.map((event) => ({
        ...event,
        created_at: new Date(event.created_at),
        event: {
          ...event.event,
          startedAt: new Date(event.event.startedAt),
        },
      }));
      entityStore.addManyEntities('normalizationSessionEvents', eventsWithDates);
    },
    deps: [id],
  });

  return state;
}
