import { sql } from 'drizzle-orm';
import { runMigrations } from 'graphile-worker';
import { Pool } from 'pg';
import type { Db, Tx } from '../shared/db';
import type { Logger } from './logger';
import { SecretString } from './secrets/secret-string';

/**
 * Task handler type for Graphile Worker
 */
export type TaskHandler<TPayload = unknown> = (
  payload: TPayload,
  ctx: {
    logger: Logger;
    db: Db;
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
