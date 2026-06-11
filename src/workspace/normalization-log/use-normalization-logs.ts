import { useEffect, useRef, useState } from 'react';
import { trpcClient } from '~/src/shared/trpc-client';
import type { NormalizationRunId } from '../normalization-run-id';
import type { WorkspaceId } from '../workspace-id';
import type { NormalizationLog } from './normalization-log';
import { NormalizationLog as NormalizationLogSchema } from './normalization-log';

const POLL_INTERVAL_MS = 1000;

function mergeLogs(
  previousLogs: NormalizationLog[],
  batch: NormalizationLog[],
): NormalizationLog[] {
  const logsBySeq = new Map(previousLogs.map((log) => [log.seq, log]));

  for (const log of batch) {
    logsBySeq.set(log.seq, log);
  }

  return Array.from(logsBySeq.values()).sort((a, b) => a.seq - b.seq);
}

export function useNormalizationLogs(input: {
  workspaceId: WorkspaceId;
  normalizationRunId: NormalizationRunId;
  isActive?: boolean;
}): { logs: NormalizationLog[] } {
  const [logs, setLogs] = useState<NormalizationLog[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isSubscribedRef = useRef(false);
  const lastSeqRef = useRef(0);

  useEffect(() => {
    setLogs([]);
    lastSeqRef.current = 0;
    isSubscribedRef.current = true;

    const pollLogs = async () => {
      if (!isSubscribedRef.current) {
        return;
      }

      try {
        const fetched = await trpcClient.workspace.normalization.logs.fetch.query({
          workspaceId: input.workspaceId,
          normalizationRunId: input.normalizationRunId,
          ...(lastSeqRef.current > 0 ? { afterSeq: lastSeqRef.current } : {}),
        });
        const batch = NormalizationLogSchema.schema.array().parse(fetched);

        if (batch.length === 0) {
          return;
        }

        lastSeqRef.current = batch[batch.length - 1]!.seq;
        setLogs((previousLogs) => mergeLogs(previousLogs, batch));
      } catch (error) {
        console.error('Normalization log poll error', error);
      }
    };

    void pollLogs();

    if (!input.isActive) {
      return () => {
        isSubscribedRef.current = false;
      };
    }

    const pollTimer = setInterval(() => {
      void pollLogs();
    }, POLL_INTERVAL_MS);

    const subscription = trpcClient.workspace.normalization.logs.subscribe.subscribe(
      {
        workspaceId: input.workspaceId,
        normalizationRunId: input.normalizationRunId,
      },
      {
        onData: (data) => {
          if (!isSubscribedRef.current) {
            return;
          }

          const batch = NormalizationLogSchema.schema.array().parse(data);

          if (batch.length > 0) {
            lastSeqRef.current = Math.max(lastSeqRef.current, batch[batch.length - 1]!.seq);
          }

          setLogs((previousLogs) => mergeLogs(previousLogs, batch));
        },
        onError: (error: Error) => {
          console.error('Normalization log subscription error', error);
        },
      },
    );

    unsubscribeRef.current = subscription.unsubscribe;

    return () => {
      isSubscribedRef.current = false;
      clearInterval(pollTimer);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [input.workspaceId, input.normalizationRunId, input.isActive]);

  return { logs };
}
