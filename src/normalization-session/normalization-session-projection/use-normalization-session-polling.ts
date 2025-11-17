import { useEffect, useMemo, useRef, useState } from 'react';
import type { RemoteResult } from '~/src/lib/result';
import { Failure, Loading, NotAsked, Success } from '~/src/lib/result';
import { trpcClient } from '~/src/shared/trpc-client';
import type { NormalizationSessionId } from '../normalization-session-id';
import { NormalizationSessionPayload } from '../normalization-session-payload/normalization-session-payload';
import { useAddNormalizationSessionPayloadToStore } from '../normalization-session-payload/normalization-session-payload-store';

export function useNormalizationSessionPolling(
  id: NormalizationSessionId,
  intervalMs = 5000,
): RemoteResult<void, Error> {
  const addToStore = useAddNormalizationSessionPayloadToStore();
  const [state, setState] = useState<RemoteResult<void, Error>>(NotAsked);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(false);

  const runOnce = useMemo(
    () => async () => {
      try {
        const data = await trpcClient.normalizationSession.projection.fetch.query({ id });
        const payload = NormalizationSessionPayload.schema.parse(data);
        addToStore(payload);
        setState((prev) =>
          prev.tag === 'notAsked' || prev.tag === 'loading' ? Success(undefined) : prev,
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState(Failure(error));
      }
    },
    [id, addToStore],
  );

  useEffect(() => {
    setState(Loading);
    isActiveRef.current = true;
    // initial fetch
    runOnce();
    // start polling
    timerRef.current = setInterval(runOnce, intervalMs);
    return () => {
      isActiveRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [intervalMs, runOnce]);

  return state;
}
