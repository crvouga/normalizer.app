import { z } from 'zod';
import { ArtifactId } from '../../artifacts/artifact-id';
import { UserId } from '../../users/user-id';
import type { NormalizationSessionEvent } from '../normalization-session-event/normalization-session-event';
import type { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import { NormalizationSessionId } from '../normalization-session-id';
import { NormalizationSessionProjectionEntry } from './normalization-session-projection-entry';

const schema = z.object({
  id: NormalizationSessionId.schema,
  targetArtifactIds: z.array(ArtifactId.schema),
  startedAt: z.coerce.date(),
  startedByUserId: UserId.schema,
  entries: z.array(NormalizationSessionProjectionEntry.schema).default([]),
});

export type NormalizationSessionProjection = z.infer<typeof schema>;

const reducer = (
  state: NormalizationSessionProjection,
  event: NormalizationSessionEvent,
): NormalizationSessionProjection => {
  switch (event.type) {
    case 'start-session':
    case 'user-started-session':
      return {
        ...state,
        id: event.sessionId,
        targetArtifactIds: event.targetArtifactIds,
        startedAt: event.startedAt,
        startedByUserId: event.startedByUserId,
        entries: [],
      };
    case 'user-requested-normalization':
      const entryNew: NormalizationSessionProjectionEntry = {
        type: 'normalization',
        normalizationRunId: event.normalizationRunId,
        id: event.normalizationRunId,
        inputArtifactIds: event.inputArtifactIds,
        outputArtifactIds: [],
        status: 'pending',
        createdAt: event.requestedAt,
      };
      return {
        ...state,
        entries: [...state.entries, entryNew],
      };
    default:
      const _check: never = event;
      console.error('Unknown event type', _check);
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
    entries: [],
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
