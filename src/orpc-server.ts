import type { S3Client, SQL } from 'bun';
import { createFileUploadRouter } from '~/src/file-upload/file-upload-orpc-server';
import type { Logger } from './lib/logger';

export const createRouter = (config: { sql: SQL; s3: S3Client; logger: Logger }) => ({
  fileUpload: createFileUploadRouter(config),
});

export type AppRouter = ReturnType<typeof createRouter>;
