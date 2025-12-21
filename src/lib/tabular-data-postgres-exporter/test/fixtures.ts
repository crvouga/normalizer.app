import { createPgliteSqlDb } from '../../../shared/sql-db';
import { createObjectStore } from '../../../shared/s3';
import { createLogger } from '../../logger';
import { isOk } from '../../result';
import type { SqlDb } from '../../sql-db/sql-db';
import type { ObjectStore } from '../../object-store/object-store';
import { PostgresClient } from '../../postgres/postgres-client';
import { TabularDataPostgresExporter } from '../tabular-data-postgres-exporter';

export const TEST_BUCKET = 'test-bucket';
export const MOCK_SERVER_BASE_URL = 'http://localhost:8080';

export interface TestFixtures {
  logger: ReturnType<typeof createLogger>;
  db: SqlDb;
  objectStore: ObjectStore;
  exporter: TabularDataPostgresExporter;
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
 * Helper function to create a test table with data
 */
export async function createTestTable(
  postgresClient: PostgresClient,
  tableName: string,
  columns: Array<{
    name: string;
    type: 'TEXT' | 'INTEGER' | 'NUMERIC' | 'BOOLEAN' | 'DATE' | 'TIMESTAMP';
    nullable?: boolean;
  }>,
  rows: Record<string, unknown>[],
): Promise<void> {
  // Create table
  const createResult = await postgresClient.createTable(tableName, columns);
  if (!isOk(createResult)) {
    throw new Error(`Failed to create table: ${createResult.error}`);
  }

  // Insert rows
  if (rows.length > 0) {
    const columnNames = columns.map((col) => col.name);
    const rowData = rows.map((row) =>
      columnNames.map((col) => {
        const value = row[col];
        if (value === null || value === undefined) {
          return null;
        }
        // Convert to string, number, or boolean
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          return value;
        }
        return String(value);
      }),
    );
    const insertResult = await postgresClient.insertBatch(tableName, columnNames, rowData);
    if (!isOk(insertResult)) {
      throw new Error(`Failed to insert rows: ${insertResult.error}`);
    }
  }
}

/**
 * Helper function to read exported file from object store
 */
export async function readExportedFile(
  objectStore: ObjectStore,
  bucket: string,
  key: string,
): Promise<Buffer> {
  const result = await objectStore.read({ bucket, key });
  if (!isOk(result)) {
    throw new Error(`Failed to read exported file: ${result.error}`);
  }
  return result.value;
}

/**
 * Setup test fixtures - call this in beforeAll
 */
export async function setupFixtures(): Promise<TestFixtures> {
  const logger = createLogger({ noop: true });
  const db = await createPgliteSqlDb({ logger });
  const objectStore = await createObjectStore({ logger, serverBaseUrl: MOCK_SERVER_BASE_URL });
  await objectStore.ensureBucketExists(TEST_BUCKET);
  const exporter = new TabularDataPostgresExporter(db, logger, objectStore);
  const postgresClient = new PostgresClient(db);
  const testTables: string[] = [];

  return {
    logger,
    db,
    objectStore,
    exporter,
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
