import { z } from 'zod';
import { ArtifactId } from '../../artifacts/artifact-id';
import { UserId } from '../../users/user-id';
import { NormalizationSessionId } from '../normalization-session-id';
import type { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import type { NormalizationSessionEvent } from '../normalization-session-event/normalization-session-event';

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
        id: event.sessionId,
        targetArtifactIds: event.targetArtifactIds,
        startedAt: event.startedAt,
        startedByUserId: event.startedByUserId,
      };
    default:
      return state;
  }
};

const init = (input: {
  sessionId: NormalizationSessionId;
  targetArtifactIds: ArtifactId[];
  startedAt: Date;
  startedByUserId: UserId;
}): NormalizationSessionProjection => {
  return {
    id: input.sessionId,
    targetArtifactIds: input.targetArtifactIds,
    startedAt: input.startedAt,
    startedByUserId: input.startedByUserId,
  };
};

const reduce = (
  events: NormalizationSessionEventEntity[],
  initialState: NormalizationSessionProjection,
) => {
  return events.reduce((state, eventEntity) => reducer(state, eventEntity.event), initialState);
};

export const NormalizationSessionProjection = {
  schema,
  reducer,
  init,
  reduce,
};
