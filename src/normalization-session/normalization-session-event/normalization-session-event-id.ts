import { z } from 'zod';

export const schema = z.string().brand<'NormalizationSessionEventId'>();

export type NormalizationSessionEventId = z.infer<typeof schema>;

const generate = (): NormalizationSessionEventId => {
  return schema.parse(crypto.randomUUID());
};

export const NormalizationSessionEventId = {
  schema,
  generate,
};
