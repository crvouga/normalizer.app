import type { Logger } from '~/src/lib/logger';
import { AppNotification } from '~/src/shared/app-notification';
import type { Db } from '~/src/shared/db';
import type { NormalizationRunId } from '../normalization-run-id';
import type { WorkspaceId } from '../workspace-id';
import {
  createNormalizationLogDb,
  type NormalizationLogInsert,
} from './normalization-log-db';

const PROGRESS_FLUSH_INTERVAL_MS = 200;
const REASONING_FLUSH_INTERVAL_MS = 80;
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

  let progressBuffer: NormalizationLogInsert[] = [];
  let reasoningBuffer: NormalizationLogInsert[] = [];
  let progressFlushTimer: ReturnType<typeof setTimeout> | null = null;
  let reasoningFlushTimer: ReturnType<typeof setTimeout> | null = null;
  let isClosed = false;
  let flushPromise: Promise<void> = Promise.resolve();

  const scheduleProgressFlush = () => {
    if (progressFlushTimer !== null || isClosed) {
      return;
    }

    progressFlushTimer = setTimeout(() => {
      progressFlushTimer = null;
      void enqueueFlush('progress');
    }, PROGRESS_FLUSH_INTERVAL_MS);
  };

  const scheduleReasoningFlush = () => {
    if (reasoningFlushTimer !== null || isClosed) {
      return;
    }

    reasoningFlushTimer = setTimeout(() => {
      reasoningFlushTimer = null;
      void enqueueFlush('reasoning');
    }, REASONING_FLUSH_INTERVAL_MS);
  };

  const flushBuffers = async (target: 'progress' | 'reasoning' | 'all'): Promise<void> => {
    const entries =
      target === 'all'
        ? [...progressBuffer, ...reasoningBuffer]
        : target === 'progress'
          ? progressBuffer
          : reasoningBuffer;

    if (target === 'all') {
      progressBuffer = [];
      reasoningBuffer = [];
    } else if (target === 'progress') {
      progressBuffer = [];
    } else {
      reasoningBuffer = [];
    }

    if (entries.length === 0) {
      return;
    }

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

      if (target === 'all') {
        progressBuffer = [...entries.filter((e) => e.kind !== 'reasoning'), ...progressBuffer];
        reasoningBuffer = [...entries.filter((e) => e.kind === 'reasoning'), ...reasoningBuffer];
      } else if (target === 'progress') {
        progressBuffer = [...entries, ...progressBuffer];
      } else {
        reasoningBuffer = [...entries, ...reasoningBuffer];
      }
    }
  };

  const enqueueFlush = (target: 'progress' | 'reasoning' | 'all') => {
    flushPromise = flushPromise.then(() => flushBuffers(target));
    return flushPromise;
  };

  const pushToBuffer = (entry: NormalizationLogInsert) => {
    if (isClosed) {
      return;
    }

    if (entry.kind === 'reasoning') {
      reasoningBuffer.push(entry);

      if (reasoningBuffer.length >= MAX_BUFFER_SIZE) {
        if (reasoningFlushTimer !== null) {
          clearTimeout(reasoningFlushTimer);
          reasoningFlushTimer = null;
        }
        void enqueueFlush('reasoning');
        return;
      }

      scheduleReasoningFlush();
      return;
    }

    progressBuffer.push(entry);

    if (progressBuffer.length >= MAX_BUFFER_SIZE) {
      if (progressFlushTimer !== null) {
        clearTimeout(progressFlushTimer);
        progressFlushTimer = null;
      }
      void enqueueFlush('progress');
      return;
    }

    scheduleProgressFlush();
  };

  return {
    push: pushToBuffer,

    async flushAndClose() {
      isClosed = true;

      if (progressFlushTimer !== null) {
        clearTimeout(progressFlushTimer);
        progressFlushTimer = null;
      }

      if (reasoningFlushTimer !== null) {
        clearTimeout(reasoningFlushTimer);
        reasoningFlushTimer = null;
      }

      await enqueueFlush('all');
    },
  };
}
