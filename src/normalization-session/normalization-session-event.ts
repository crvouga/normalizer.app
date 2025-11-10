import { z } from 'zod';
import { ArtifactId } from '../artifacts/artifact-id';
import { UserId } from '../users/user-id';

export const SessionEvent = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start-session'),
    targetArtifactIds: z.array(ArtifactId.schema),
    startedAt: z.coerce.date(),
    startedByUserId: UserId.schema,
  }),
]);

export type SessionEvent = z.infer<typeof SessionEvent>;
