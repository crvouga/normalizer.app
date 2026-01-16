import { useMemo } from 'react';
import { shallowEqual, useEntityStoreSelector } from '../../store/entity-store';
import type { WorkspaceEventId } from '../workspace-event/workspace-event-id';
import type { WorkspaceEventEntity } from '../workspace-event/workspace-event-entity';
import type { WorkspaceId } from '../workspace-id';

/**
 * Hook for selecting workspace events from the entity store by workspace ID.
 *
 * @param sessionId - The workspace ID to filter events by
 * @returns Array of workspace events for the workspace
 */
export function useWorkspaceEventsSelector(sessionId: WorkspaceId): WorkspaceEventEntity[] {
  // Get event IDs from the index with shallow equality check
  const eventIds: WorkspaceEventId[] = useEntityStoreSelector(
    (state) => state.indexes.indexWorkspaceEventsBySessionId[sessionId] || [],
    shallowEqual,
  );

  // Get the events byId object with shallow equality check
  const eventsById = useEntityStoreSelector(
    (state) => state.entities.workspaceEvents.byId,
    shallowEqual,
  );

  // Map IDs to entities with memoization to prevent unnecessary recalculations
  const events = useMemo(
    () =>
      eventIds
        .map((id) => eventsById[id])
        .filter((e): e is NonNullable<typeof e> => e !== undefined),
    [eventIds, eventsById],
  );

  return events;
}
