import { z } from "zod";

export const CurrentScreen = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("start-normalization"),
  }),
  z.object({
    type: z.literal("normalization-workflow"),
    input: z.string(),
  }),
]);

export type CurrentScreen = z.infer<typeof CurrentScreen>;
