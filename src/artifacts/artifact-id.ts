import { randomUUID } from 'crypto';
import { z } from 'zod';

export const schema = z.string().brand<'ArtifactId'>();

export type ArtifactId = z.infer<typeof schema>;

const generate = (): ArtifactId => {
  return schema.parse(randomUUID());
};

export const ArtifactId = {
  schema,
  generate,
};
