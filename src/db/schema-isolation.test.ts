import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, test } from 'bun:test';
import { DB_SCHEMA_NAME } from './db-schema';
import * as schema from './schema';

const TABLES = [
  schema.artifacts,
  schema.users,
  schema.userSessions,
  schema.workspaceEvents,
  schema.workspaceProjections,
  schema.keyValueStore,
] as const;

describe('schema isolation', () => {
  test('every table is bound to the app schema', () => {
    for (const table of TABLES) {
      expect(getTableConfig(table).schema).toBe(DB_SCHEMA_NAME);
    }
  });
});
