import type { S3Client, SQL } from 'bun';
import { createFileUploadRouter } from '~/src/file-upload/file-upload-router';
import type { Logger } from './lib/logger';
import { router } from './lib/trpc';

export const createAppRouter = (config: { sql: SQL; s3: S3Client; logger: Logger }) =>
  router({
    fileUpload: createFileUploadRouter(config),
  });

export type AppRouter = ReturnType<typeof createAppRouter>;
