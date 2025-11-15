import z from 'zod';
import type { RemoteResult } from '../../lib/result';
import { useLoader } from '../../lib/use-loader';
import { useEntityStore } from '../../store/entity-store';
import { trpcClient } from '../../shared/trpc-client';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import type { NormalizationSessionId } from '../normalization-session-id';
import { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';

/**
 * Hook for loading normalization session events from the server and storing them in the entity store.
 *
 * @param id - The normalization session ID to load events for
 * @returns The current remote result state (RemoteResult<void, Error>)
 */
export function useNormalizationSessionLoader(
  id: NormalizationSessionId,
): RemoteResult<void, Error> {
  const entityStore = useEntityStore();

  const { state } = useLoader({
    async loadData() {
      const response = await trpcClient.normalizationSession.events.getBySessionId.mutate({ id });
      const events = z.array(NormalizationSessionEventEntity.schema).parse(response.events);
      const projection = NormalizationSessionProjection.schema.parse(response.projection);
      entityStore.addManyEntities('normalizationSessionProjections', [projection]);
      entityStore.addManyEntities('normalizationSessionEvents', events);
      entityStore.addManyEntities('resourceOwnerships', response.resourceOwnership);
    },
    deps: [id],
  });

  return state;
}
