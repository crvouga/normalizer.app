import { defineConfig } from 'drizzle-kit';
import { DB_SCHEMA_NAME } from './src/db/db-schema';

const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './migrations',
  schemaFilter: [DB_SCHEMA_NAME],
  dbCredentials: {
    url,
  },
});
