import { z } from 'zod';

export const schema = z.string().brand<'NormalizationRunId'>();

export type NormalizationRunId = z.infer<typeof schema>;

const generate = (): NormalizationRunId => {
  return schema.parse(crypto.randomUUID());
};

export const NormalizationRunId = {
  schema,
  generate,
};
