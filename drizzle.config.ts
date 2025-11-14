import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

console.log('url', url);

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './migrations',
  dbCredentials: {
    url,
  },
});
