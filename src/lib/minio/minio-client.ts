import * as Minio from "minio";
import type { Logger } from "../logger";

export const createMinioClient = ({
  minioEndpoint,
  accessKey,
  secretKey,
  logger,
}: {
  minioEndpoint: string;
  accessKey: string;
  secretKey: string;
  logger: Logger;
}) => {
  // Parse the endpoint to extract host and port
  const url = new URL(minioEndpoint);
  const endPoint = url.hostname;
  const port = url.port
    ? parseInt(url.port)
    : url.protocol === "https:"
    ? 443
    : 80;
  const useSSL = url.protocol === "https:";

  // Create MinIO client instance
  const minioClient = new Minio.Client({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
  });

  const checkBucketExists = async (bucket: string): Promise<boolean> => {
    try {
      const exists = await minioClient.bucketExists(bucket);
      logger.info(exists ? "Bucket already exists" : "Bucket does not exist", {
        bucket,
      });
      return exists;
    } catch (error) {
      logger.warn("Error checking bucket existence", {
        bucket,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  };

  const createBucket = async (bucket: string): Promise<void> => {
    logger.info("Creating bucket...", { bucket });

    try {
      // Check if bucket already exists first
      const exists = await minioClient.bucketExists(bucket);
      if (exists) {
        throw new Error("Bucket already exists");
      }

      // Create bucket with default region
      await minioClient.makeBucket(bucket, "us-east-1");
      logger.info("Successfully created bucket", { bucket });
    } catch (error) {
      logger.error("Error creating bucket", {
        bucket,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  const ensureBucketExists = async (bucket: string): Promise<void> => {
    logger.info("Checking if bucket exists...", { bucket });

    try {
      const exists = await checkBucketExists(bucket);
      if (!exists) {
        await createBucket(bucket);
      }
    } catch (error) {
      logger.error("Error ensuring bucket exists", {
        bucket,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw the error - let the application continue without S3
      logger.warn("Continuing without S3 bucket - some features may not work");
    }
  };

  return {
    checkBucketExists,
    createBucket,
    ensureBucketExists,
  };
};
