import { pgSchema } from 'drizzle-orm/pg-core';

export const DB_SCHEMA_NAME = 'normalizer_app' as const;
export const GRAPHILE_WORKER_SCHEMA_NAME = 'normalizer_app_graphile_worker' as const;

export const dbSchema = pgSchema(DB_SCHEMA_NAME);
