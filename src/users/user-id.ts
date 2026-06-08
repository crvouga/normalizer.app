import { z } from 'zod';
import { randomUUID } from '../lib/random-uuid';

export const schema = z.string().brand<'UserId'>();

export type UserId = z.infer<typeof schema>;

const generate = (): UserId => {
  return schema.parse(randomUUID());
};

export const UserId = {
  schema,
  generate,
};
