import type { S3Client, SQL } from 'bun';
import { createFileUploadRouter } from '~/src/file-upload/file-upload-trpc-router';
import type { Logger } from './lib/logger';
import { router } from './lib/trpc-server';

export const createRouter = (config: { sql: SQL; s3: S3Client; logger: Logger }) =>
  router({
    fileUpload: createFileUploadRouter(),
  });

export type AppRouter = ReturnType<typeof createRouter>;
