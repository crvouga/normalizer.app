import { sql } from 'drizzle-orm';
import { runMigrations } from 'graphile-worker';
import { Pool } from 'pg';
import { z } from 'zod';
import type { Db, Tx } from '../shared/db';
import type { Logger } from './logger';
import { SecretString } from './secrets/secret-string';

/**
 * Task handler type for Graphile Worker
 */
export type TaskHandler<TPayload = unknown, TCtx = unknown> = (
  ctx: TCtx,
  payload: TPayload,
) => Promise<void>;

/**
 * Extract the union of all job type names from a discriminated union
 */
export type ExtractJobName<TJobs extends { type: string }> = TJobs['type'];

/**
 * Extract the payload type for a specific job name (without the 'type' discriminant)
 */
export type ExtractPayload<T extends { type: string }> = Omit<T, 'type'>;

/**
 * Map each job name to its payload type
 */
export type JobPayloadMap<TJobs extends { type: string }> = {
  [K in ExtractJobName<TJobs>]: ExtractPayload<Extract<TJobs, { type: K }>>;
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
    const schemaCheck = await db.execute(
      sql`SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'graphile_worker') as exists`,
    );
    const schemaExists = schemaCheck[0]?.exists === true;

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
 * Ensure Graphile Worker is set up in the database
 * Initializes the schema if it doesn't exist
 */
export async function ensureGraphileWorkerSetup({
  db,
  logger,
}: {
  db: Db;
  logger: Logger;
}): Promise<{
  wasAlreadySetup: boolean;
  isSetup: boolean;
}> {
  logger.info('Ensuring Graphile Worker is set up...');
  // Check if already set up
  const checkResult = await checkGraphileWorkerSetup(db, logger);

  if (checkResult.isSetup) {
    logger.info('Graphile Worker is already set up');
    return { wasAlreadySetup: true, isSetup: true };
  }

  // Initialize the schema
  logger.info('Initializing Graphile Worker schema...');

  const databaseUrl = SecretString.fromEnvVar('DATABASE_URL');
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');

  const pool = new Pool({ connectionString: databaseUrl.DANGEROUSLY_readValue() });

  try {
    await runMigrations({ pgPool: pool });

    logger.info('Graphile Worker schema initialized successfully');

    // Verify setup
    const verifyResult = await checkGraphileWorkerSetup(db, logger);

    if (!verifyResult.isSetup) {
      logger.error('Graphile Worker setup verification failed', verifyResult);
      return { wasAlreadySetup: false, isSetup: false };
    }

    return { wasAlreadySetup: false, isSetup: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to initialize Graphile Worker schema', { error: errorMessage });
    throw new Error(`Failed to initialize Graphile Worker: ${errorMessage}`);
  } finally {
    await pool.end();
  }
}

/**
 * Get the Zod schema for a job name (payload without the 'type' discriminant)
 * Extracts the schema from a discriminated union at runtime
 */
export function getJobSchema<TJobs extends { type: string }>(
  jobsSchema: z.ZodDiscriminatedUnion<'type', z.ZodDiscriminatedUnionOption<'type'>[]>,
  jobName: ExtractJobName<TJobs>,
): z.ZodSchema {
  // Find the matching option in the discriminated union
  for (const jobOption of jobsSchema.options) {
    const shape = jobOption.shape;
    if (shape && 'type' in shape && shape.type instanceof z.ZodLiteral) {
      if (shape.type.value === jobName) {
        // Return the schema without the 'type' discriminant field
        return jobOption.omit({ type: true });
      }
    }
  }

  // This should never happen if jobName is correctly derived from the Jobs schema
  throw new Error(`Unknown job name: ${String(jobName)}`);
}

/**
 * Type-safe function to enqueue a Graphile Worker job within a transaction
 * Uses Zod schema validation to ensure payload matches the job schema
 */
export async function enqueueJob<
  TJobs extends { type: string },
  TJobName extends ExtractJobName<TJobs>,
>(
  tx: Tx,
  jobsSchema: z.ZodDiscriminatedUnion<'type', z.ZodDiscriminatedUnionOption<'type'>[]>,
  jobName: TJobName,
  payload: JobPayloadMap<TJobs>[TJobName],
): Promise<void> {
  const schema = getJobSchema<TJobs>(jobsSchema, jobName);
  const validatedPayload = schema.parse(payload);
  const payloadJson = JSON.stringify(validatedPayload);
  const escapedPayloadJson = payloadJson.replace(/'/g, "''");
  try {
    await tx.execute(
      sql.raw(`SELECT graphile_worker.add_job('${jobName}'::text, '${escapedPayloadJson}'::json)`),
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
 * Create the task list for Graphile Worker
 * Returns a task list compatible with Graphile Worker's TaskList interface
 * while providing type safety through validation
 * Handlers are derived from the Jobs schema - each job name must have a corresponding handler
 */
export function createTaskList<TJobs extends { type: string }, Ctx>(
  jobsSchema: z.ZodDiscriminatedUnion<'type', z.ZodDiscriminatedUnionOption<'type'>[]>,
  ctx: Ctx,
  handlers: { [K in ExtractJobName<TJobs>]: TaskHandler<JobPayloadMap<TJobs>[K], Ctx> },
) {
  const taskList: Record<string, (payload: unknown, helpers: unknown) => Promise<void>> = {};

  // Build task list dynamically from Jobs schema
  for (const jobOption of jobsSchema.options) {
    const shape = jobOption.shape;
    if (shape && 'type' in shape && shape.type instanceof z.ZodLiteral) {
      const jobName = shape.type.value as ExtractJobName<TJobs>;
      const payloadSchema = getJobSchema<TJobs>(jobsSchema, jobName);
      const handler = handlers[jobName];

      taskList[jobName] = async (payload: unknown, _helpers: unknown) => {
        const validatedPayload = payloadSchema.parse(payload);
        await handler(ctx, validatedPayload);
      };
    }
  }

  return taskList;
}
