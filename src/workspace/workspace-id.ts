import { z } from 'zod';
import { randomUUID } from '../lib/random-uuid';

export const schema = z.string().brand<'WorkspaceId'>();

export type WorkspaceId = z.infer<typeof schema>;

const generate = (): WorkspaceId => {
  return schema.parse(randomUUID());
};

export const WorkspaceId = {
  schema,
  generate,
};
