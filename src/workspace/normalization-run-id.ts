import { z } from 'zod';
import { randomUUID } from '../lib/random-uuid';

export const schema = z.string().brand<'NormalizationRunId'>();

export type NormalizationRunId = z.infer<typeof schema>;

const generate = (): NormalizationRunId => {
  return schema.parse(randomUUID());
};

export const NormalizationRunId = {
  schema,
  generate,
};
