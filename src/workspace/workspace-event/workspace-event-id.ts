import { z } from 'zod';
import { randomUUID } from '../../lib/random-uuid';

export const schema = z.string().brand<'WorkspaceEventId'>();

export type WorkspaceEventId = z.infer<typeof schema>;

const generate = (): WorkspaceEventId => {
  return schema.parse(randomUUID());
};

export const WorkspaceEventId = {
  schema,
  generate,
};
