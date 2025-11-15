import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db, Tx } from '../sql';
import type { Logger } from './logger';
import { NormalizationSessionId } from '../normalization-session/normalization-session-id';

export const normalizationJobPayloadSchema = z.object({
  sessionId: NormalizationSessionId.schema,
});

export type NormalizationJobPayload = z.infer<typeof normalizationJobPayloadSchema>;

export type JobName = 'normalization';

export type JobPayloadMap = {
  normalization: NormalizationJobPayload;
};

/**
 * Check if Graphile Worker is set up in the database
 */
export async function checkGraphileWorkerSetup(
  db: Db,
  logger: Logger,
): Promise<{
  isSetup: boolean;
  schemaExists: boolean;
  functionExists: boolean;
  error?: string;
}> {
  try {
    // Check if graphile_worker schema exists
    const schemaCheck = await db.execute(
      sql`SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'graphile_worker') as exists`,
    );
    const schemaExists = schemaCheck[0]?.exists === true;

    // Check if add_job function exists
    const functionCheck = await db.execute(
      sql`SELECT EXISTS(
        SELECT 1 
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'graphile_worker' 
        AND p.proname = 'add_job'
      ) as exists`,
    );
    const functionExists = functionCheck[0]?.exists === true;

    const isSetup = schemaExists && functionExists;

    if (!isSetup) {
      logger.warn('Graphile Worker is not fully set up', {
        schemaExists,
        functionExists,
      });
    }

    return {
      isSetup,
      schemaExists,
      functionExists,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error checking Graphile Worker setup', { error: errorMessage });
    return {
      isSetup: false,
      schemaExists: false,
      functionExists: false,
      error: errorMessage,
    };
  }
}

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

  const payloadJson = JSON.stringify(validatedPayload);

  // Job name must be a string literal, not a parameter
  // Since jobName is type-safe (constrained to JobName), it's safe to use as a literal
  // Escape single quotes in JSON for SQL string literal
  const escapedJson = payloadJson.replace(/'/g, "''");

  try {
    // Construct SQL with job name as literal text and JSON as json (not jsonb)
    // Function signature: add_job(identifier text, payload json, ...)
    await tx.execute(
      sql.raw(`SELECT graphile_worker.add_job('${jobName}'::text, '${escapedJson}'::json)`),
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to enqueue Graphile Worker job '${jobName}': ${errorMessage}. ` +
        `Make sure Graphile Worker is initialized by running the worker at least once.`,
    );
  }
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
 * Task handler type for Graphile Worker
 */
export type TaskHandler<TPayload = unknown> = (
  payload: TPayload,
  helpers: {
    logger: {
      info: (msg: string, meta?: Record<string, unknown>) => void;
      error: (msg: string, meta?: Record<string, unknown>) => void;
      warn: (msg: string, meta?: Record<string, unknown>) => void;
      debug: (msg: string, meta?: Record<string, unknown>) => void;
    };
  },
) => Promise<void>;

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
