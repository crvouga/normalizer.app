import { z } from 'zod';
import { randomUUID } from '../lib/random-uuid';

export const schema = z.string().brand<'ArtifactId'>();

export type ArtifactId = z.infer<typeof schema>;

const generate = (): ArtifactId => {
  return schema.parse(randomUUID());
};

export const ArtifactId = {
  schema,
  generate,
};
