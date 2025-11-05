import { initTRPC } from '@trpc/server';
import type { S3Client, SQL } from 'bun';
import type { Logger } from './logger';

// Create context type
export type Context = {
  sql: SQL;
  s3: S3Client;
  logger: Logger;
};

// Create context function
export const createContext = (config: { sql: SQL; s3: S3Client; logger: Logger }): Context => {
  return {
    sql: config.sql,
    s3: config.s3,
    logger: config.logger,
  };
};

// Initialize tRPC
const t = initTRPC.context<Context>().create();

// Export procedure creator and router helper
export const procedure = t.procedure;
export const router = t.router;
