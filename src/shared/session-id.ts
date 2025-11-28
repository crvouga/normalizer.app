import { z } from 'zod';

export const schema = z.string().brand<'SessionId'>();

export type SessionId = z.infer<typeof schema>;

const generate = (): SessionId => {
  return schema.parse(crypto.randomUUID());
};

export const fromString = (string: string): SessionId => {
  return schema.parse(string);
};

export const SessionId = {
  schema,
  generate,
  fromString,
};
