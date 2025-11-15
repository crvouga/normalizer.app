import { z } from 'zod';
import { ArtifactId } from '../../artifacts/artifact-id';
import { UserId } from '../../users/user-id';
import { NormalizationSessionId } from '../normalization-session-id';
import { NormalizationRunId } from '../normalization-run-id';

const schema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('user-started-session'),
    sessionId: NormalizationSessionId.schema,
    targetArtifactIds: z.array(ArtifactId.schema),
    startedAt: z.coerce.date(),
    startedByUserId: UserId.schema,
  }),
  z.object({
    type: z.literal('user-requested-normalization'),
    sessionId: NormalizationSessionId.schema,
    inputArtifactIds: z.array(ArtifactId.schema),
    requestedAt: z.coerce.date(),
    requestedByUserId: UserId.schema,
    normalizationRunId: NormalizationRunId.schema,
  }),
  z.object({
    type: z.literal('user-canceled-normalization'),
    sessionId: NormalizationSessionId.schema,
    normalizationRunId: NormalizationRunId.schema,
    canceledAt: z.coerce.date(),
    canceledByUserId: UserId.schema,
  }),
]);

export type NormalizationSessionEvent = z.infer<typeof schema>;

export const NormalizationSessionEvent = {
  schema,
};
