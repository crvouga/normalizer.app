import { z } from 'zod';

export const schema = z.string().brand<'WorkspaceEventId'>();

export type WorkspaceEventId = z.infer<typeof schema>;

const generate = (): WorkspaceEventId => {
  return schema.parse(crypto.randomUUID());
};

export const WorkspaceEventId = {
  schema,
  generate,
};
