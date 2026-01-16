import { useEffect, useRef, useState } from 'react';
import type { RemoteResult } from '../../lib/result';
import { Failure, Loading, NotAsked, Success } from '../../lib/result';
import { trpcClient } from '../../shared/trpc-client';
import type { WorkspaceId } from '../workspace-id';
import { WorkspacePayload } from '../workspace-payload/workspace-payload';
import { useAddWorkspacePayloadToStore } from '../workspace-payload/workspace-payload-store';

/**
 * Hook for subscribing to workspace projection updates from the server via SSE.
 * Automatically updates the entity store as new data arrives in real-time.
 *
 * @param id - The workspace ID to subscribe to
 * @returns The current remote result state (RemoteResult<void, Error>)
 */
export function useWorkspaceSubscription(id: WorkspaceId): RemoteResult<void, Error> {
  const addToStore = useAddWorkspacePayloadToStore();
  const [state, setState] = useState<RemoteResult<void, Error>>(NotAsked);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    setState(Loading);
    isSubscribedRef.current = true;

    const subscription = trpcClient.workspace.projection.subscribe.subscribe(
      { id },
      {
        onData: (data) => {
          if (!isSubscribedRef.current) return;

          const payload = WorkspacePayload.schema.parse(data);

          addToStore(payload);

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
  }, [id, addToStore]);

  return state;
}
