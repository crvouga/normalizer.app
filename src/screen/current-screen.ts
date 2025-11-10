import { z } from 'zod';
import { NormalizationSessionId } from '../normalization-session/normalization-session-id';

export const CurrentScreen = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('normalization-session'),
    normalizationSessionId: NormalizationSessionId.schema.nullable(),
  }),
]);

export type CurrentScreen = z.infer<typeof CurrentScreen>;
