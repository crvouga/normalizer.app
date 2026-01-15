import { z } from 'zod';
import { ArtifactId } from '../../artifacts/artifact-id';
import { UserId } from '../../users/user-id';
import { WorkspaceId } from '../workspace-id';
import { NormalizationRunId } from '../normalization-run-id';

const schema = z.discriminatedUnion('type', [
  // legacy events
  z.object({
    type: z.literal('start-session'),
    sessionId: WorkspaceId.schema,
    targetArtifactIds: z.array(ArtifactId.schema),
    startedAt: z.coerce.date(),
    startedByUserId: UserId.schema,
  }),
  //
  z.object({
    type: z.literal('user-started-session'),
    sessionId: WorkspaceId.schema,
    targetArtifactIds: z.array(ArtifactId.schema),
    startedAt: z.coerce.date(),
    startedByUserId: UserId.schema,
  }),
  z.object({
    type: z.literal('user-requested-normalization'),
    sessionId: WorkspaceId.schema,
    inputArtifactIds: z.array(ArtifactId.schema),
    requestedAt: z.coerce.date(),
    requestedByUserId: UserId.schema,
    normalizationRunId: NormalizationRunId.schema,
  }),
  z.object({
    type: z.literal('user-canceled-normalization'),
    sessionId: WorkspaceId.schema,
    normalizationRunId: NormalizationRunId.schema,
    canceledAt: z.coerce.date(),
    canceledByUserId: UserId.schema,
  }),
  z.object({
    type: z.literal('system-normalization-completed'),
    sessionId: WorkspaceId.schema,
    normalizationRunId: NormalizationRunId.schema,
    outputArtifactIds: z.array(ArtifactId.schema),
    completedAt: z.coerce.date(),
  }),
]);

export type WorkspaceEvent = z.infer<typeof schema>;

export const WorkspaceEvent = {
  schema,
};
