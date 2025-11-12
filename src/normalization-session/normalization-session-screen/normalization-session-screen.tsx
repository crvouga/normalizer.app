import { useMemo } from 'react';
import { shallowEqual, useEntityStoreSelector } from '~/src/store/entity-store';
import type { NormalizationSessionEventId } from '../normalization-session-event/normalization-session-event-id';
import type { NormalizationSessionId } from '../normalization-session-id';
import { useNormalizationSessionLoader } from './use-normalization-session-loader';

export const NormalizationSessionScreen = (props: {
  normalizationSessionId: NormalizationSessionId;
}) => {
  useNormalizationSessionLoader(props.normalizationSessionId);

  // Get event IDs from the index with shallow equality check
  const eventIds: NormalizationSessionEventId[] = useEntityStoreSelector(
    (state) =>
      state.indexes.normalizationSessionEventsBySessionId[props.normalizationSessionId] || [],
    shallowEqual,
  );

  // Get the events byId object with shallow equality check
  const eventsById = useEntityStoreSelector(
    (state) => state.entities.normalizationSessionEvents.byId,
    shallowEqual,
  );

  // Map IDs to entities with memoization to prevent unnecessary recalculations
  const normalizationSessionEvents = useMemo(
    () =>
      eventIds
        .map((id) => eventsById[id])
        .filter((e): e is NonNullable<typeof e> => e !== undefined),
    [eventIds, eventsById],
  );

  return (
    <div className="flex h-full w-full items-start justify-center p-8">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        {normalizationSessionEvents.map((e) => (
          <div key={e.id} className="flex flex-col gap-2">
            <p>{e.event.type}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
