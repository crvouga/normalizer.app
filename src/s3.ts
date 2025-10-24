import { S3Client } from "bun";
import type { Logger } from "./lib/logger";
import { createMinioClient } from "./lib/minio/minio-client";
import { getS3Config } from "./s3-config";

export const createS3 = async ({
  logger,
}: {
  logger: Logger;
}): Promise<S3Client> => {
  const { s3Endpoint, s3AccessKeyId, s3SecretAccessKey, s3Bucket } =
    getS3Config();

  logger.info("Initializing S3 client...");
  try {
    const s3Client = new S3Client({
      endpoint: s3Endpoint,
      accessKeyId: s3AccessKeyId,
      secretAccessKey: s3SecretAccessKey,
    });

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
        "Failed to ensure bucket exists, but continuing with S3 client",
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }

    logger.info("Successfully initialized S3 client");
    return s3Client;
  } catch (error) {
    logger.error("Failed to initialize S3 client:", error);
    throw new Error("Failed to initialize S3 client");
  }
};
