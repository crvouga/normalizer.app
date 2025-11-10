import { useMemo } from 'react';
import { useEntityStoreSelector } from '~/src/store/entity-store';
import type { NormalizationSessionId } from '../normalization-session-id';
import { useNormalizationSessionLoader } from '../use-normalization-session-loader';

export const NormalizationSessionStartedScreen = (props: {
  normalizationSessionId: NormalizationSessionId;
}) => {
  const loadingState = useNormalizationSessionLoader(props.normalizationSessionId);

  // // Get event IDs from the index
  // const eventIds = useEntityStoreSelector(
  //   (state) =>
  //     state.indexes.normalizationSessionEventsBySessionId[props.normalizationSessionId] || [],
  // );

  // // Get the events byId object
  // const eventsById = useEntityStoreSelector(
  //   (state) => state.entities.normalizationSessionEvents.byId,
  // );

  // // Map IDs to entities with memoization to prevent unnecessary recalculations
  // const normalizationSessionEvents = useMemo(
  //   () => eventIds.map((id) => eventsById[id]).filter(Boolean),
  //   [eventIds, eventsById],
  // );

  return (
    <div className="flex h-full w-full items-start justify-center p-8">
      {/* <div className="flex w-full max-w-2xl flex-col gap-6">
        {normalizationSessionEvents.map((e) => (
          <div key={e.id} className="flex flex-col gap-2">
            <p>{e.event.type}</p>
          </div>
        ))}
      </div> */}
    </div>
  );
};
