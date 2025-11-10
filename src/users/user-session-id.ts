import { z } from 'zod';

export const schema = z.string().brand<'UserSessionId'>();

export type UserSessionId = z.infer<typeof schema>;

const generate = (): UserSessionId => {
  return schema.parse(crypto.randomUUID());
};

export const UserSessionId = {
  schema,
  generate,
};
