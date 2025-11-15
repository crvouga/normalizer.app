import { z } from 'zod';
import type { Tx } from '../sql';
import { enqueueJob as enqueueJobLib, type TaskHandler } from '../lib/graphile-worker-lib';
import { NormalizationSessionId } from '../normalization-session/normalization-session-id';

// Application-specific job payload schemas
export const normalizationJobPayloadSchema = z.object({
  sessionId: NormalizationSessionId.schema,
});

export type NormalizationJobPayload = z.infer<typeof normalizationJobPayloadSchema>;

// Application-specific job name type
export type JobName = 'normalization';

// Application-specific job payload type map
export type JobPayloadMap = {
  normalization: NormalizationJobPayload;
};

/**
 * Type-safe function to enqueue a Graphile Worker job within a transaction
 */
export async function enqueueJob<TJobName extends JobName>(
  tx: Tx,
  jobName: TJobName,
  payload: JobPayloadMap[TJobName],
): Promise<void> {
  const schema = getJobSchema(jobName);
  const validatedPayload = schema.parse(payload);
  await enqueueJobLib(tx, jobName, validatedPayload);
}

/**
 * Get the Zod schema for a job name
 */
function getJobSchema(jobName: JobName): z.ZodSchema {
  switch (jobName) {
    case 'normalization':
      return normalizationJobPayloadSchema;
    default:
      throw new Error(`Unknown job name: ${jobName satisfies never}`);
  }
}

/**
 * Create the task list for Graphile Worker
 * Returns a task list compatible with Graphile Worker's TaskList interface
 * while providing type safety through validation
 */
export function createTaskList(handlers: { normalization: TaskHandler<NormalizationJobPayload> }) {
  return {
    normalization: async (payload: unknown, helpers: Parameters<TaskHandler>[1]) => {
      const validatedPayload = normalizationJobPayloadSchema.parse(payload);
      await handlers.normalization(validatedPayload, helpers);
    },
  };
}

// Re-export library functions for convenience
export { checkGraphileWorkerSetup, type TaskHandler } from '../lib/graphile-worker-lib';
