import { sql } from 'drizzle-orm';
import type { Db, Tx } from '../shared/db';
import type { Logger } from './logger';

/**
 * Task handler type for Graphile Worker
 */
export type TaskHandler<TPayload = unknown> = (
  payload: TPayload,
  ctx: {
    logger: Logger;
  },
) => Promise<void>;

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
 * Enqueue a Graphile Worker job within a transaction
 * This is a generic function that works with any job name and payload
 */
export async function enqueueJob(tx: Tx, jobName: string, payload: unknown): Promise<void> {
  const payloadJson = JSON.stringify(payload);
  const escapedJson = payloadJson.replace(/'/g, "''");

  try {
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
