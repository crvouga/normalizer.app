import { z } from 'zod';
import { ArtifactId } from '../artifacts/artifact-id';

export const SessionEvent = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start-session'),
    targetArtifactIds: z.array(ArtifactId.schema),
  }),
]);

export type SessionEvent = z.infer<typeof SessionEvent>;
