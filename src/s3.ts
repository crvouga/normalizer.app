import type { Logger } from "./lib/logger";
import { createMinioClient } from "./lib/minio/minio-client";
import { getS3Config } from "./s3-config";

export const createS3 = async ({
  logger,
}: {
  logger: Logger;
}): Promise<ReturnType<typeof createMinioClient>> => {
  const { s3Endpoint, s3AccessKeyId, s3SecretAccessKey, s3Bucket } =
    getS3Config();

  logger.info("Initializing MinIO client...", {
    endpoint: s3Endpoint,
    bucket: s3Bucket,
  });

  try {
    const minioClient = createMinioClient({
      minioEndpoint: s3Endpoint,
      accessKey: s3AccessKeyId,
      secretKey: s3SecretAccessKey,
      logger,
    });

    // Try to ensure bucket exists, but don't fail if it doesn't work
    try {
      await minioClient.ensureBucketExists(s3Bucket);
    } catch (error) {
      logger.warn(
        "Failed to ensure bucket exists, but continuing with MinIO client",
        {
          error: error instanceof Error ? error.message : String(error),
          endpoint: s3Endpoint,
          bucket: s3Bucket,
        }
      );
    }

    logger.info("Successfully initialized MinIO client", {
      endpoint: s3Endpoint,
      bucket: s3Bucket,
    });
    return minioClient;
  } catch (error) {
    logger.error("Failed to initialize MinIO client:", {
      error,
      endpoint: s3Endpoint,
      bucket: s3Bucket,
    });
    throw new Error("Failed to initialize MinIO client");
  }
};
