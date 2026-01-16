import { z } from 'zod';
import { WorkspaceEvent } from './workspace-event';
import { WorkspaceEventPersistedLegacy } from './workspace-event-persisted-legacy';

const schema = z.discriminatedUnion('type', [
  ...WorkspaceEvent.SCHEMAS,
  ...WorkspaceEventPersistedLegacy.SCHEMAS,
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
