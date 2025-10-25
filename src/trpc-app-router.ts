import type { SQL } from "bun";
import { createFileUploadRouter } from "~/src/file-upload/file-upload-router";
import type { Logger } from "./lib/logger";
import { type MinioClient } from "./lib/minio/minio-client";
import { router } from "./lib/trpc";

export const createAppRouter = (config: {
  sql: SQL;
  minioClient: MinioClient;
  logger: Logger;
}) =>
  router({
    fileUpload: createFileUploadRouter(config),
  });

export type AppRouter = ReturnType<typeof createAppRouter>;
