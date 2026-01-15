import { z } from 'zod';
import { ArtifactId } from '../../artifacts/artifact-id';
import { UserId } from '../../users/user-id';
import type { WorkspaceEvent } from '../workspace-event/workspace-event';
import { WorkspaceEventEntity } from '../workspace-event/workspace-event-entity';
import { WorkspaceId } from '../workspace-id';
import { WorkspaceProjectionEntry } from './workspace-projection-entry';

const schema = z.object({
  id: WorkspaceId.schema,
  targetArtifactIds: z.array(ArtifactId.schema),
  startedAt: z.coerce.date(),
  startedByUserId: UserId.schema,
  entries: z.array(WorkspaceProjectionEntry.schema).default([]),
  lastUpdatedAt: z.coerce.date().default(() => new Date()),
});

export type WorkspaceProjection = z.infer<typeof schema>;

const reducer = (state: WorkspaceProjection, event: WorkspaceEvent): WorkspaceProjection => {
  switch (event.type) {
    case 'user-started-session':
      return {
        ...state,
        id: event.sessionId,
        targetArtifactIds: event.targetArtifactIds,
        startedAt: event.startedAt,
        startedByUserId: event.startedByUserId,
        entries: [],
      };
    case 'user-requested-normalization':
      const latestEntry = state.entries[state.entries.length - 1];

      if (latestEntry?.status === 'in_progress') {
        return state;
      }

      const entryNew: WorkspaceProjectionEntry = {
        type: 'normalization',
        normalizationRunId: event.normalizationRunId,
        id: event.normalizationRunId,
        inputArtifactIds: event.inputArtifactIds,
        outputArtifactIds: [],
        status: 'in_progress',
        createdAt: event.requestedAt,
      };
      return {
        ...state,
        entries: [...state.entries, entryNew],
      };
    case 'user-canceled-normalization':
      const entryIndex = state.entries.findIndex(
        (entry) =>
          entry.type === 'normalization' && entry.normalizationRunId === event.normalizationRunId,
      );

      if (entryIndex === -1) {
        return state;
      }

      const entryToCancel = state.entries[entryIndex];
      if (!entryToCancel) {
        return state;
      }

      if (entryToCancel.type !== 'normalization' || entryToCancel.status !== 'in_progress') {
        return state;
      }

      const canceledEntry: WorkspaceProjectionEntry = {
        type: 'normalization',
        normalizationRunId: entryToCancel.normalizationRunId,
        id: entryToCancel.id,
        inputArtifactIds: entryToCancel.inputArtifactIds,
        outputArtifactIds: entryToCancel.outputArtifactIds,
        status: 'canceled',
        createdAt: entryToCancel.createdAt,
      };

      const updatedEntries = [...state.entries];
      updatedEntries[entryIndex] = canceledEntry;

      return {
        ...state,
        entries: updatedEntries,
      };
    case 'system-normalization-completed':
      const completedEntryIndex = state.entries.findIndex(
        (entry) =>
          entry.type === 'normalization' && entry.normalizationRunId === event.normalizationRunId,
      );

      if (completedEntryIndex === -1) {
        return state;
      }

      const entryToComplete = state.entries[completedEntryIndex];
      if (!entryToComplete) {
        return state;
      }

      if (entryToComplete.type !== 'normalization' || entryToComplete.status !== 'in_progress') {
        return state;
      }

      const completedEntry: WorkspaceProjectionEntry = {
        type: 'normalization',
        normalizationRunId: entryToComplete.normalizationRunId,
        id: entryToComplete.id,
        inputArtifactIds: entryToComplete.inputArtifactIds,
        outputArtifactIds: event.outputArtifactIds,
        status: 'completed',
        createdAt: entryToComplete.createdAt,
      };

      const updatedEntriesCompleted = [...state.entries];
      updatedEntriesCompleted[completedEntryIndex] = completedEntry;

      return {
        ...state,
        entries: updatedEntriesCompleted,
      };
    default:
      const _check: never = event;
      console.error('Unknown event type', _check);
      return state;
  }
};

const init = (input: {
  sessionId: WorkspaceId;
  targetArtifactIds: ArtifactId[];
  startedAt: Date;
  startedByUserId: UserId;
  lastUpdatedAt: Date;
}): WorkspaceProjection => {
  return {
    id: input.sessionId,
    targetArtifactIds: input.targetArtifactIds,
    startedAt: input.startedAt,
    startedByUserId: input.startedByUserId,
    entries: [],
    lastUpdatedAt: input.lastUpdatedAt,
  };
};

const reduce = (events: WorkspaceEventEntity[], initialState: WorkspaceProjection) => {
  return events.reduce((state, eventEntity) => reducer(state, eventEntity.event), initialState);
};

const isNormalizing = (state: WorkspaceProjection): boolean => {
  return state.entries.some(
    (entry) => entry.type === 'normalization' && entry.status === 'in_progress',
  );
};

const shouldStartNormalizationJob = (
  before: WorkspaceProjection,
  after: WorkspaceProjection,
): boolean => {
  return !isNormalizing(before) && isNormalizing(after);
};

const toArtifactIds = (projection: WorkspaceProjection): Set<ArtifactId> => {
  const artifactIds: ArtifactId[] = [];
  for (const id of projection.targetArtifactIds) {
    artifactIds.push(id);
  }
  for (const entry of projection.entries) {
    for (const id of entry.inputArtifactIds) {
      artifactIds.push(id);
    }
    for (const id of entry.outputArtifactIds) {
      artifactIds.push(id);
    }
  }
  return new Set(artifactIds);
};

export const WorkspaceProjection = {
  schema,
  reducer,
  init,
  reduce,
  isNormalizing,
  shouldStartNormalizationJob,
  toArtifactIds,
};
