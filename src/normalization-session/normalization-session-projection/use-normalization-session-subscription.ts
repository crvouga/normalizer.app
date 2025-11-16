import { useEffect, useRef, useState } from 'react';
import type { RemoteResult } from '../../lib/result';
import { Failure, Loading, NotAsked, Success } from '../../lib/result';
import { trpcClient } from '../../shared/trpc-client';
import type { NormalizationSessionId } from '../normalization-session-id';
import { useAddProjectionPayloadToStore } from './add-projection-payload-to-store';

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
  const addProjectionPayloadToStore = useAddProjectionPayloadToStore();
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

          addProjectionPayloadToStore(data);

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
  }, [id, addProjectionPayloadToStore]);

  return state;
}
