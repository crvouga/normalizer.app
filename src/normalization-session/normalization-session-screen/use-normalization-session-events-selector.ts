import { useMemo } from 'react';
import { shallowEqual, useEntityStoreSelector } from '../../store/entity-store';
import type { NormalizationSessionEventId } from '../normalization-session-event/normalization-session-event-id';
import type { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import type { NormalizationSessionId } from '../normalization-session-id';

/**
 * Hook for selecting normalization session events from the entity store by session ID.
 *
 * @param sessionId - The session ID to filter events by
 * @returns Array of normalization session events for the session
 */
export function useNormalizationSessionEventsSelector(
  sessionId: NormalizationSessionId,
): NormalizationSessionEventEntity[] {
  // Get event IDs from the index with shallow equality check
  const eventIds: NormalizationSessionEventId[] = useEntityStoreSelector(
    (state) => state.indexes.normalizationSessionEventsBySessionId[sessionId] || [],
    shallowEqual,
  );

  // Get the events byId object with shallow equality check
  const eventsById = useEntityStoreSelector(
    (state) => state.entities.normalizationSessionEvents.byId,
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
