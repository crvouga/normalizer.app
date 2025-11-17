import { useCallback } from 'react';
import { useEntityStore } from '~/src/store/entity-store';
import { NormalizationSessionPayload } from './normalization-session-payload';

export function useAddNormalizationSessionPayloadToStore() {
  const entityStore = useEntityStore();
  return useCallback(
    (payload: NormalizationSessionPayload) => {
      const parsed = NormalizationSessionPayload.schema.safeParse(payload);
      if (!parsed.success) {
        console.error('Invalid projection payload', parsed.error);
        return;
      }
      const { events, projections, artifacts, resourceOwnership } = parsed.data;

      if (events.length > 0) {
        entityStore.addManyEntities('normalizationSessionEvents', events);
      }
      if (projections.length > 0) {
        entityStore.addManyEntities('normalizationSessionProjections', projections);
      }
      if (artifacts.length > 0) {
        entityStore.addManyEntities('artifacts', artifacts);
      }
      if (resourceOwnership.length > 0) {
        entityStore.addManyEntities('resourceOwnerships', resourceOwnership);
      }
    },
    [entityStore],
  );
}
