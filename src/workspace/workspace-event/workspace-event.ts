import { z } from 'zod';
import { ArtifactId } from '../../artifacts/artifact-id';
import { UserId } from '../../users/user-id';
import { NormalizationRunId } from '../normalization-run-id';
import { WorkspaceId } from '../workspace-id';

const SCHEMAS = [
  z.object({
    type: z.literal('workspace/user-started'),
    workspaceId: WorkspaceId.schema,
    targetArtifactIds: z.array(ArtifactId.schema),
    startedAt: z.coerce.date(),
    startedByUserId: UserId.schema,
  }),
  z.object({
    type: z.literal('normalization/user-requested'),
    workspaceId: WorkspaceId.schema,
    targetArtifactIds: z.array(ArtifactId.schema),
    inputArtifactIds: z.array(ArtifactId.schema),
    requestedAt: z.coerce.date(),
    requestedByUserId: UserId.schema,
    normalizationRunId: NormalizationRunId.schema,
  }),
  z.object({
    type: z.literal('normalization/user-canceled'),
    workspaceId: WorkspaceId.schema,
    normalizationRunId: NormalizationRunId.schema,
    canceledAt: z.coerce.date(),
    canceledByUserId: UserId.schema,
  }),
  z.object({
    type: z.literal('normalization/system-completed'),
    workspaceId: WorkspaceId.schema,
    normalizationRunId: NormalizationRunId.schema,
    outputArtifactIds: z.array(ArtifactId.schema),
    completedAt: z.coerce.date(),
  }),
] as const;

const schema = z.discriminatedUnion('type', SCHEMAS);

export type WorkspaceEvent = z.infer<typeof schema>;

export const WorkspaceEvent = {
  schema,
  SCHEMAS,
};
