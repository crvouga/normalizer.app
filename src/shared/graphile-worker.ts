import { z } from 'zod';
import {
  createTaskList as createTaskListLib,
  enqueueJob as enqueueJobLib,
  type TaskHandler as TaskHandlerLib,
  type JobPayloadMap,
} from '../lib/graphile-worker-lib';
import type { Logger } from '../lib/logger';
import { WorkspaceId } from '../workspace/workspace-id';
import type { Db, Tx } from './db';

export type JobCtx = {
  logger: Logger;
  db: Db;
};

export const Job = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('normalization'),
    sessionId: WorkspaceId.schema,
  }),
]);
export type Job = z.infer<typeof Job>;

export type TaskHandler<TJobName extends Job['type']> = TaskHandlerLib<
  JobPayloadMap<Job>[TJobName],
  JobCtx
>;

export async function enqueueJob(tx: Tx, job: Job): Promise<void> {
  await enqueueJobLib(tx, Job, job.type, job);
}

export function createTaskList(ctx: JobCtx, handlers: { [K in Job['type']]: TaskHandler<K> }) {
  return createTaskListLib<Job, JobCtx>(Job, ctx, handlers);
}
