import z from 'zod';

const schema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('llm_chunk'),
    chunk: z.string(),
  }),
  z.object({
    type: z.literal('tool_call'),
    toolCall: z.object({
      name: z.string(),
      arguments: z.record(z.any()),
    }),
  }),
  z.object({
    type: z.literal('tool_result'),
    toolResult: z.object({
      name: z.string(),
      result: z.any(),
    }),
  }),
]);

export type NormalizerEvent = z.infer<typeof schema>;

export const NormalizerEvent = {
  schema,
};
