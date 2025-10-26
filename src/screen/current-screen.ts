import { z } from "zod";

export const CurrentScreen = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("normalization-workflow"),
    normalizationWorkflowId: z.string(),
  }),
]);

export type CurrentScreen = z.infer<typeof CurrentScreen>;
