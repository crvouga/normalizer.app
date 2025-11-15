import z from 'zod';
import { ArtifactId } from '~/src/artifacts/artifact-id';
import { NormalizationRunId } from '../normalization-run-id';

const schema = z.object({
  type: z.enum(['normalization']),
  normalizationRunId: NormalizationRunId.schema,
  id: z.string(),
  inputArtifactIds: z.array(ArtifactId.schema),
  outputArtifactIds: z.array(ArtifactId.schema),
  status: z.enum(['in_progress', 'completed', 'failed', 'canceled']),
  createdAt: z.coerce.date(),
});

export type NormalizationSessionProjectionEntry = z.infer<typeof schema>;

export const NormalizationSessionProjectionEntry = {
  schema,
};
