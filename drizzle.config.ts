import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './migrations',
  dbCredentials: {
    url,
  },
});
