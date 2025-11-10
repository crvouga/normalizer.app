import { z } from 'zod';

export const schema = z.string().brand<'NormalizationSessionId'>();

export type NormalizationSessionId = z.infer<typeof schema>;

const generate = (): NormalizationSessionId => {
  return schema.parse(crypto.randomUUID());
};

export const NormalizationSessionId = {
  schema,
  generate,
};
