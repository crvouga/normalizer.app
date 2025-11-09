import { z } from 'zod';

export const schema = z.string().brand<'SessionId'>();

export type SessionId = z.infer<typeof schema>;

const generate = (): SessionId => {
  return schema.parse(crypto.randomUUID());
};

export const SessionId = {
  schema,
  generate,
};
