import { S3Client } from "bun";
import type { Logger } from "./lib/logger";
import { createMinioClient } from "./lib/minio/minio-client";

export const getS3Config = () => {
  const s3Endpoint = process.env.S3_ENDPOINT;
  if (!s3Endpoint) {
    throw new Error("S3_ENDPOINT environment variable is not set");
  }
  const s3AccessKeyId = process.env.S3_ACCESS_KEY;
  if (!s3AccessKeyId) {
    throw new Error("S3_ACCESS_KEY environment variable is not set");
  }
  const s3SecretAccessKey = process.env.S3_SECRET_KEY;
  if (!s3SecretAccessKey) {
    throw new Error("S3_SECRET_KEY environment variable is not set");
  }
  const s3Bucket = process.env.S3_BUCKET;
  if (!s3Bucket) {
    throw new Error("S3_BUCKET environment variable is not set");
  }
  return {
    s3Endpoint,
    s3AccessKeyId,
    s3SecretAccessKey,
    s3Bucket,
  };
};

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
