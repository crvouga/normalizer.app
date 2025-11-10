import { z } from 'zod';
import { ArtifactId } from '../artifacts/artifact-id';
import { UserId } from '../users/user-id';
import { NormalizationSessionId } from './normalization-session-id';
import type { NormalizationSessionEventEntity } from './normalization-session-event-entity';
import type { NormalizationSessionEvent } from './normalization-session-event';

const schema = z.object({
  id: NormalizationSessionId.schema,
  targetArtifactIds: z.array(ArtifactId.schema),
  startedAt: z.coerce.date(),
  startedByUserId: UserId.schema,
});

export type NormalizationSessionProjection = z.infer<typeof schema>;

const reducer = (
  state: NormalizationSessionProjection,
  event: NormalizationSessionEvent,
): NormalizationSessionProjection => {
  switch (event.type) {
    case 'start-session':
      return {
        ...state,
        targetArtifactIds: event.targetArtifactIds,
        startedAt: event.startedAt,
        startedByUserId: event.startedByUserId,
      };
    default:
      return state;
  }
};

export const NormalizationSessionProjection = {
  schema,
  reducer,
};
