import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createLogger } from '../lib/logger';
import * as schema from './schema';
import { WorkspaceEventPersisted } from '../workspace/workspace-event/workspace-event-persisted';

/**
 * Prompts the user for a database URL
 */
function promptDatabaseUrl(): string {
  const url = prompt('Enter database URL: ');
  if (!url || url.trim() === '') {
    throw new Error('Database URL is required');
  }
  return url.trim();
}

/**
 * Creates a postgres connection from a database URL string
 */
function createPostgresConnectionFromUrl(
  databaseUrl: string,
  logger: ReturnType<typeof createLogger>,
): ReturnType<typeof postgres> {
  // Log non-sensitive database config
  const dbUrlObj = new URL(databaseUrl);
  logger.info('Database configuration:', {
    host: dbUrlObj.hostname,
    port: dbUrlObj.port,
    database: dbUrlObj.pathname.slice(1),
    user: dbUrlObj.username,
    // Omit password for security
  });

  // Ensure SSL is enabled for production databases (non-localhost)
  const isLocalhost =
    dbUrlObj.hostname === 'localhost' ||
    dbUrlObj.hostname === '127.0.0.1' ||
    dbUrlObj.hostname === '::1';

  if (!isLocalhost && !dbUrlObj.searchParams.has('sslmode') && !dbUrlObj.searchParams.has('ssl')) {
    dbUrlObj.searchParams.set('sslmode', 'require');
    logger.info('Added SSL mode to database connection');
  }

  logger.info('Creating database connection...');
  const sql = postgres(dbUrlObj.toString());

  return sql;
}

/**
 * Migrates all workspace events in the database
 */
export async function migrateWorkspaceEvents(databaseUrl: string): Promise<void> {
  const logger = createLogger().child('WorkspaceEventsMigration');

  logger.info('🔧 Starting workspace events migration...');

  let postgresConnection: ReturnType<typeof postgres> | null = null;

  try {
    // Create database connection
    postgresConnection = createPostgresConnectionFromUrl(databaseUrl, logger);
    const db = drizzle(postgresConnection, { schema });

    // Test connection
    logger.info('Testing database connection...');
    await postgresConnection`SELECT 1`;
    logger.info('✅ Database connection successful');

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let totalProcessed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    // Process events in batches from the database
    const batchSize = 100;
    let offset = 0;
    let batchNumber = 0;
    let hasMore = true;

    logger.info('Starting batch processing of workspace events...');

    while (hasMore) {
      batchNumber++;

      // Fetch a batch of events from the database
      logger.info(`Fetching batch ${batchNumber} (offset: ${offset}, limit: ${batchSize})...`);
      const batch = await db
        .select()
        .from(schema.workspaceEvents)
        .orderBy(schema.workspaceEvents.created_at)
        .limit(batchSize)
        .offset(offset);

      if (batch.length === 0) {
        hasMore = false;
        logger.info('No more events to process');
        break;
      }

      logger.info(`Processing batch ${batchNumber} (${batch.length} events)...`);

      try {
        await db.transaction(async (tx) => {
          for (const row of batch) {
            try {
              // Parse the event JSON
              const parseResult = WorkspaceEventPersisted.schema.safeParse(row.event);

              if (!parseResult.success) {
                logger.warn('Failed to parse event', {
                  eventId: row.id,
                  error: parseResult.error.message,
                });
                errors.push({
                  id: row.id,
                  error: `Parse error: ${parseResult.error.message}`,
                });
                errorCount++;
                totalProcessed++;
                continue;
              }

              // Migrate the event (migrate function handles all cases, including no-op)
              const migratedEvent = WorkspaceEventPersisted.migrate(parseResult.data);

              // Check if the event actually changed
              const eventChanged =
                JSON.stringify(parseResult.data) !== JSON.stringify(migratedEvent);

              if (!eventChanged) {
                skippedCount++;
                totalProcessed++;
                continue;
              }

              // Update the row
              await tx
                .update(schema.workspaceEvents)
                .set({
                  event: migratedEvent,
                })
                .where(eq(schema.workspaceEvents.id, row.id));

              migratedCount++;
              totalProcessed++;

              if (migratedCount % 10 === 0) {
                logger.debug(`Migrated ${migratedCount} events so far...`);
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              logger.error('Error migrating event', {
                eventId: row.id,
                error: errorMessage,
              });
              errors.push({
                id: row.id,
                error: errorMessage,
              });
              errorCount++;
              totalProcessed++;
            }
          }
        });

        logger.info(`Batch ${batchNumber} completed (processed ${totalProcessed} total so far)`);

        // Check if we got fewer rows than batch size, meaning we're done
        if (batch.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Transaction failed for batch ${batchNumber}`, {
          error: errorMessage,
        });
        // Continue with next batch
        errorCount += batch.length;
        totalProcessed += batch.length;
        for (const row of batch) {
          errors.push({
            id: row.id,
            error: `Transaction error: ${errorMessage}`,
          });
        }
        // Still advance offset to avoid infinite loop
        if (batch.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
      }
    }

    // Log summary
    logger.info('✅ Migration completed');
    logger.info('Summary:', {
      total: totalProcessed,
      migrated: migratedCount,
      skipped: skippedCount,
      errors: errorCount,
    });

    if (errors.length > 0) {
      logger.warn('Errors encountered:', {
        errorCount: errors.length,
        sampleErrors: errors.slice(0, 5), // Show first 5 errors
      });
    }
  } catch (error) {
    logger.error('❌ Migration failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  } finally {
    // Cleanup connection
    if (postgresConnection) {
      logger.info('Closing database connection...');
      await postgresConnection.end();
      logger.info('Database connection closed');
    }
  }
}

/**
 * Main entry point
 * Usage: bun run src/db/migrate-workspace-events.ts
 */
const main = async () => {
  const logger = createLogger();

  try {
    const databaseUrl = promptDatabaseUrl();
    await migrateWorkspaceEvents(databaseUrl);
    logger.info('✅ Workspace events migration completed successfully');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Migration failed:', err as Record<string, unknown>);
    process.exit(1);
  }
};

// Allow running directly: bun run src/db/migrate-workspace-events.ts
if (import.meta.main) {
  main();
}
