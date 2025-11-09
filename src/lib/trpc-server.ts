import { initTRPC } from '@trpc/server';
import type { S3Client } from 'bun';
import type { Logger } from './logger';
import type { Db } from '../sql';
import type { MinioClient } from './minio/minio-client';

// Create context type
export type Context = {
  db: Db;
  s3: S3Client;
  minioClient: MinioClient;
  logger: Logger;
};

// Create context function
export const createContext = (config: {
  db: Db;
  s3: S3Client;
  minioClient: MinioClient;
  logger: Logger;
}): Context => {
  return {
    db: config.db,
    s3: config.s3,
    minioClient: config.minioClient,
    logger: config.logger,
  };
};

// Initialize tRPC
const t = initTRPC.context<Context>().create();

// Export procedure creator and router helper
export const procedure = t.procedure;
export const router = t.router;
