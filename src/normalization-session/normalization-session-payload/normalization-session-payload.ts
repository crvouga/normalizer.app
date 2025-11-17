import z from 'zod';
import { Artifact } from '~/src/artifacts/artifact';
import { ResourceOwnershipEntity } from '~/src/permissions/resource-ownership-entity';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';

const schema = z.object({
  events: z.array(NormalizationSessionEventEntity.schema),
  projections: z.array(NormalizationSessionProjection.schema),
  artifacts: z.array(Artifact.schema),
  resourceOwnership: z.array(ResourceOwnershipEntity.schema),
});

export type NormalizationSessionPayload = z.infer<typeof schema>;

export const NormalizationSessionPayload = {
  schema,
};
