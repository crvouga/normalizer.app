import { useEffect, useRef, useState } from 'react';
import { trpcClient } from '~/src/shared/trpc-client';
import type { NormalizationRunId } from '../normalization-run-id';
import type { WorkspaceId } from '../workspace-id';
import type { NormalizationLog } from './normalization-log';
import { NormalizationLog as NormalizationLogSchema } from './normalization-log';

export function useNormalizationLogs(input: {
  workspaceId: WorkspaceId;
  normalizationRunId: NormalizationRunId;
}): { logs: NormalizationLog[] } {
  const [logs, setLogs] = useState<NormalizationLog[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    setLogs([]);
    isSubscribedRef.current = true;

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

          setLogs((previousLogs) => {
            const logsBySeq = new Map(previousLogs.map((log) => [log.seq, log]));

            for (const log of batch) {
              logsBySeq.set(log.seq, log);
            }

            return Array.from(logsBySeq.values()).sort((a, b) => a.seq - b.seq);
          });
        },
        onError: (error: Error) => {
          console.error('Normalization log subscription error', error);
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
  }, [input.workspaceId, input.normalizationRunId]);

  return { logs };
}
