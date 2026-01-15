import { z } from 'zod';
import { ArtifactId } from '../../artifacts/artifact-id';
import { UserId } from '../../users/user-id';
import { NormalizationRunId } from '../normalization-run-id';
import { WorkspaceId } from '../workspace-id';
import { WorkspaceEvent } from './workspace-event';

const schema = z.discriminatedUnion('type', [
  ...WorkspaceEvent.SCHEMAS,
  z.object({
    type: z.literal('start-session'),
    sessionId: WorkspaceId.schema,
    targetArtifactIds: z.array(ArtifactId.schema),
    startedAt: z.coerce.date(),
    startedByUserId: UserId.schema,
  }),
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

export type WorkspaceEventPersisted = z.infer<typeof schema>;

function migrate(persisted: WorkspaceEventPersisted): WorkspaceEvent {
  switch (persisted.type) {
    case 'user-started-session':
    case 'start-session': {
      return {
        type: 'workspace/user-started',
        workspaceId: persisted.sessionId,
        targetArtifactIds: persisted.targetArtifactIds,
        startedAt: persisted.startedAt,
        startedByUserId: persisted.startedByUserId,
      };
    }
    case 'system-normalization-completed': {
      return {
        type: 'normalization/system-completed',
        workspaceId: persisted.sessionId,
        normalizationRunId: persisted.normalizationRunId,
        outputArtifactIds: persisted.outputArtifactIds,
        completedAt: persisted.completedAt,
      };
    }
    case 'user-requested-normalization': {
      return {
        type: 'normalization/user-requested',
        workspaceId: persisted.sessionId,
        inputArtifactIds: persisted.inputArtifactIds,
        requestedAt: persisted.requestedAt,
        requestedByUserId: persisted.requestedByUserId,
        normalizationRunId: persisted.normalizationRunId,
        targetArtifactIds: [],
      };
    }
    case 'user-canceled-normalization': {
      return {
        type: 'normalization/user-canceled',
        workspaceId: persisted.sessionId,
        normalizationRunId: persisted.normalizationRunId,
        canceledAt: persisted.canceledAt,
        canceledByUserId: persisted.canceledByUserId,
      };
    }
    default: {
      return persisted;
    }
  }
}

export const WorkspaceEventPersisted = {
  schema,
  migrate,
};
