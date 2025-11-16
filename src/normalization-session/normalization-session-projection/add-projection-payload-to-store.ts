import { useCallback } from 'react';
import z from 'zod';
import { Artifact } from '~/src/artifacts/artifact';
import { ResourceOwnershipEntity } from '~/src/permissions/resource-ownership-entity';
import { NormalizationSessionProjection } from './normalization-session-projection';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import { useEntityStore } from '~/src/store/entity-store';

export const ProjectionPayloadSchema = z.object({
  events: z.array(NormalizationSessionEventEntity.schema),
  projection: NormalizationSessionProjection.schema,
  artifacts: z.array(Artifact.schema),
  resourceOwnership: z.array(ResourceOwnershipEntity.schema),
});

export function useAddProjectionPayloadToStore() {
  const entityStore = useEntityStore();
  return useCallback(
    (payload: unknown) => {
      const parsed = ProjectionPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        console.error('Invalid projection payload', parsed.error);
        return;
      }
      const { events, projection, artifacts, resourceOwnership } = parsed.data;

      if (events.length > 0) {
        entityStore.addManyEntities('normalizationSessionEvents', events);
      }
      if (projection) {
        entityStore.addManyEntities('normalizationSessionProjections', [projection]);
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
