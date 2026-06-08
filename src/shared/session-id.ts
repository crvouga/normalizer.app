import { z } from 'zod';
import { randomUUID } from '../lib/random-uuid';

export const schema = z.string().brand<'SessionId'>();

export type SessionId = z.infer<typeof schema>;

const generate = (): SessionId => {
  return schema.parse(randomUUID());
};

export const fromString = (string: string): SessionId => {
  return schema.parse(string);
};

export const SessionId = {
  schema,
  generate,
  fromString,
};
