import z from 'zod';
import { NormalizationRunId } from '../normalization-run-id';

const schema = z.object({
  type: z.enum(['normalization']),
  normalizationRunId: NormalizationRunId.schema,
  id: z.string(),
  inputArtifactIds: z.array(z.string()),
  outputArtifactIds: z.array(z.string()),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  createdAt: z.coerce.date(),
});

export type NormalizationSessionProjectionEntry = z.infer<typeof schema>;

export const NormalizationSessionProjectionEntry = {
  schema,
};
