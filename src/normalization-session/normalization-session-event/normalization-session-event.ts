import { z } from 'zod';
import { ArtifactId } from '../../artifacts/artifact-id';
import { UserId } from '../../users/user-id';
import { NormalizationSessionId } from '../normalization-session-id';

const schema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start-session'),
    sessionId: NormalizationSessionId.schema,
    targetArtifactIds: z.array(ArtifactId.schema),
    startedAt: z.coerce.date(),
    startedByUserId: UserId.schema,
  }),
]);

export type NormalizationSessionEvent = z.infer<typeof schema>;

export const NormalizationSessionEvent = {
  schema,
};
