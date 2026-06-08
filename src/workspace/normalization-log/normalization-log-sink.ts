import type { Logger } from '~/src/lib/logger';
import { AppNotification } from '~/src/shared/app-notification';
import type { Db } from '~/src/shared/db';
import type { NormalizationRunId } from '../normalization-run-id';
import type { WorkspaceId } from '../workspace-id';
import {
  createNormalizationLogDb,
  type NormalizationLogInsert,
} from './normalization-log-db';

const FLUSH_INTERVAL_MS = 200;
const MAX_BUFFER_SIZE = 25;

export type NormalizationLogSink = {
  push: (entry: NormalizationLogInsert) => void;
  flushAndClose: () => Promise<void>;
};

export function createNormalizationLogSink(params: {
  db: Db;
  logger: Logger;
  workspaceId: WorkspaceId;
  normalizationRunId: NormalizationRunId;
}): NormalizationLogSink {
  const { db, logger, workspaceId, normalizationRunId } = params;
  const logDb = createNormalizationLogDb({ db });
  const appNotification = new AppNotification(db);

  let buffer: NormalizationLogInsert[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let isClosed = false;
  let flushPromise: Promise<void> = Promise.resolve();

  const scheduleFlush = () => {
    if (flushTimer !== null || isClosed) {
      return;
    }

    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, FLUSH_INTERVAL_MS);
  };

  const flush = async (): Promise<void> => {
    if (buffer.length === 0) {
      return;
    }

    const entries = buffer;
    buffer = [];

    try {
      await logDb.insertBatch({
        workspaceId,
        normalizationRunId,
        entries,
      });

      await appNotification.notify({
        type: 'normalization_log',
        payload: workspaceId,
      });
    } catch (error) {
      logger.error('Failed to flush normalization logs', {
        workspaceId,
        normalizationRunId,
        entryCount: entries.length,
        error: error instanceof Error ? error.message : String(error),
      });
      buffer = [...entries, ...buffer];
    }
  };

  const enqueueFlush = () => {
    flushPromise = flushPromise.then(() => flush());
    return flushPromise;
  };

  return {
    push(entry: NormalizationLogInsert) {
      if (isClosed) {
        return;
      }

      buffer.push(entry);

      if (buffer.length >= MAX_BUFFER_SIZE) {
        if (flushTimer !== null) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        void enqueueFlush();
        return;
      }

      scheduleFlush();
    },

    async flushAndClose() {
      isClosed = true;

      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }

      await enqueueFlush();
    },
  };
}
