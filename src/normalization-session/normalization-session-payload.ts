import { useCallback } from 'react';
import z from 'zod';
import { Artifact } from '~/src/artifacts/artifact';
import { ResourceOwnershipEntity } from '~/src/permissions/resource-ownership-entity';
import { useEntityStore } from '~/src/store/entity-store';
import { NormalizationSessionEventEntity } from './normalization-session-event/normalization-session-event-entity';
import { NormalizationSessionProjection } from './normalization-session-projection/normalization-session-projection';

const schema = z.object({
  events: z.array(NormalizationSessionEventEntity.schema),
  projections: z.array(NormalizationSessionProjection.schema),
  artifacts: z.array(Artifact.schema),
  resourceOwnership: z.array(ResourceOwnershipEntity.schema),
});

export type NormalizationSessionPayload = z.infer<typeof schema>;

export function useAddNormalizationSessionPayloadToStore() {
  const entityStore = useEntityStore();
  return useCallback(
    (payload: NormalizationSessionPayload) => {
      const parsed = schema.safeParse(payload);
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

export const NormalizationSessionPayload = { schema };
