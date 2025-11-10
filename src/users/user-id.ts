import { z } from 'zod';

export const schema = z.string().brand<'UserId'>();

export type UserId = z.infer<typeof schema>;

const generate = (): UserId => {
  return schema.parse(crypto.randomUUID());
};

export const UserId = {
  schema,
  generate,
};
