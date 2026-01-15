import { z } from 'zod';

export const schema = z.string().brand<'WorkspaceId'>();

export type WorkspaceId = z.infer<typeof schema>;

const generate = (): WorkspaceId => {
  return schema.parse(crypto.randomUUID());
};

export const WorkspaceId = {
  schema,
  generate,
};
