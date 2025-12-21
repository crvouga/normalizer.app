import { createPgliteSqlDb } from '../../../shared/sql-db';
import { createObjectStore } from '../../../shared/s3';
import { createLogger } from '../../logger';
import { isOk } from '../../result';
import { getContentType } from '../../tabular-data-format';
import type { SqlDb } from '../../sql-db/sql-db';
import type { ObjectStore } from '../../object-store/object-store';
import { PostgresClient } from '../../postgres/postgres-client';
import { TabularDataPostgresImporter } from '../tabular-data-postgres-importer';

export const TEST_BUCKET = 'test-bucket';
export const MOCK_SERVER_BASE_URL = 'http://localhost:8080';

export interface TestFixtures {
  logger: ReturnType<typeof createLogger>;
  db: SqlDb;
  objectStore: ObjectStore;
  importer: TabularDataPostgresImporter;
  postgresClient: PostgresClient;
  testTables: string[];
}

/**
 * Helper function to escape PostgreSQL identifiers (for cleanup only)
 */
export function escapeIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Helper function to write CSV content to S3
 */
export async function writeCsvToS3(
  objectStore: ObjectStore,
  key: string,
  csvContent: string,
): Promise<void> {
  const result = await objectStore.write({
    bucket: TEST_BUCKET,
    key,
    data: Buffer.from(csvContent, 'utf-8'),
    contentType: getContentType('csv'),
  });
  if (!isOk(result)) {
    throw new Error(`Failed to write CSV to S3: ${result.error}`);
  }
}

/**
 * Setup test fixtures - call this in beforeAll
 */
export async function setupFixtures(): Promise<TestFixtures> {
  const logger = createLogger({ noop: true });
  const db = await createPgliteSqlDb({ logger });
  const objectStore = await createObjectStore({ logger, serverBaseUrl: MOCK_SERVER_BASE_URL });
  await objectStore.ensureBucketExists(TEST_BUCKET);
  const importer = new TabularDataPostgresImporter(db, logger, objectStore);
  const postgresClient = new PostgresClient(db);
  const testTables: string[] = [];

  return {
    logger,
    db,
    objectStore,
    importer,
    postgresClient,
    testTables,
  };
}

/**
 * Cleanup test fixtures - call this in afterAll
 */
export async function cleanupFixtures(fixtures: TestFixtures): Promise<void> {
  const { db, testTables } = fixtures;

  // Clean up test tables
  for (const tableName of testTables) {
    await db.execute(`DROP TABLE IF EXISTS ${escapeIdentifier(tableName)}`);
  }

  // Close database connection
  const closeResult = await db.close();
  if (!isOk(closeResult)) {
    throw new Error(`Failed to close database: ${closeResult.error}`);
  }
}
