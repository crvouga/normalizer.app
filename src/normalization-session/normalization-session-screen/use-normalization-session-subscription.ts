import { useEffect, useRef, useState } from 'react';
import type { RemoteResult } from '../../lib/result';
import { Failure, Loading, NotAsked, Success } from '../../lib/result';
import { useEntityStore } from '../../store/entity-store';
import { trpcClient } from '../../shared/trpc-client';
import { Artifact } from '../../artifacts/artifact';
import { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';
import { ResourceOwnershipEntity } from '../../permissions/resource-ownership-entity';
import type { NormalizationSessionId } from '../normalization-session-id';
import z from 'zod';

/**
 * Hook for subscribing to normalization session projection updates from the server via SSE.
 * Automatically updates the entity store as new data arrives in real-time.
 *
 * @param id - The normalization session ID to subscribe to
 * @returns The current remote result state (RemoteResult<void, Error>)
 */
export function useNormalizationSessionSubscription(
  id: NormalizationSessionId,
): RemoteResult<void, Error> {
  const entityStore = useEntityStore();
  const [state, setState] = useState<RemoteResult<void, Error>>(NotAsked);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    setState(Loading);
    isSubscribedRef.current = true;

    const subscription = trpcClient.normalizationSession.projection.subscribe.subscribe(
      { id },
      {
        onData: (data) => {
          if (!isSubscribedRef.current) return;

          const projection = NormalizationSessionProjection.schema.safeParse(data.projection);
          const artifacts = z.array(Artifact.schema).safeParse(data.artifacts);
          const resourceOwnership = z
            .array(ResourceOwnershipEntity.schema)
            .safeParse(data.resourceOwnership);

          if (!projection.success || !artifacts.success || !resourceOwnership.success) {
            console.error('Failed to parse subscription data', {
              projection: projection.success ? 'ok' : projection.error,
              artifacts: artifacts.success ? 'ok' : artifacts.error,
              resourceOwnership: resourceOwnership.success ? 'ok' : resourceOwnership.error,
            });
            return;
          }

          entityStore.addManyEntities('normalizationSessionProjections', [projection.data]);
          entityStore.addManyEntities('artifacts', artifacts.data);
          entityStore.addManyEntities('resourceOwnerships', resourceOwnership.data);

          setState((prevState) => {
            if (prevState.tag === 'loading' || prevState.tag === 'notAsked') {
              return Success(undefined);
            }
            return prevState;
          });
        },
        onError: (error: Error) => {
          if (isSubscribedRef.current) {
            setState(Failure(error));
          }
        },
      },
    );

    unsubscribeRef.current = subscription.unsubscribe;

    return () => {
      isSubscribedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [id, entityStore]);

  return state;
}
