import { z } from 'zod';
import { randomUUID } from '../lib/random-uuid';

export const schema = z.string().brand<'UserSessionId'>();

export type UserSessionId = z.infer<typeof schema>;

const generate = (): UserSessionId => {
  return schema.parse(randomUUID());
};

export const UserSessionId = {
  schema,
  generate,
};
