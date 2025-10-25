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

  const setBucketPolicy = async (bucket: string): Promise<void> => {
    logger.info("Setting bucket policy...", { bucket });

    try {
      // Policy that allows public read and write access to the bucket
      // This is needed for presigned URLs to work
      const policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
            Resource: [`arn:aws:s3:::${bucket}/*`],
          },
        ],
      };

      await minioClient.setBucketPolicy(bucket, JSON.stringify(policy));
      logger.info("Successfully set bucket policy", { bucket });
    } catch (error) {
      logger.error("Error setting bucket policy", {
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
        // Set the bucket policy after creating the bucket
        await setBucketPolicy(bucket);
      } else {
        // Even if bucket exists, ensure policy is set
        try {
          await setBucketPolicy(bucket);
        } catch (error) {
          logger.warn("Failed to set bucket policy on existing bucket", {
            bucket,
            error: error instanceof Error ? error.message : String(error),
          });
        }
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
    setBucketPolicy,
    ensureBucketExists,
  };
};
