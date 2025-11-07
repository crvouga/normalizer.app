import { z } from 'zod';

export const CurrentScreen = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('normalization-session'),
    normalizationSessionId: z.string().nullable(),
  }),
]);

export type CurrentScreen = z.infer<typeof CurrentScreen>;
