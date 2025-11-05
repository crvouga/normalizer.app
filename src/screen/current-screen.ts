import { z } from 'zod';

export const CurrentScreen = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('normalization-workflow'),
    normalizationWorkflowId: z.string().nullable(),
  }),
]);

export type CurrentScreen = z.infer<typeof CurrentScreen>;
