import type { Logger } from "../logger";

// In-memory storage for testing bucket state
const bucketState = new Map<string, boolean>();

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
  // Create auth headers for MinIO API requests using AWS signature
  const createAuthHeaders = (method: string, path: string) => {
    // For MinIO, we need to use AWS signature v4 or basic auth
    // Using basic auth for simplicity in this implementation
    return {
      Authorization: `Basic ${btoa(`${accessKey}:${secretKey}`)}`,
      "Content-Type": "application/xml",
    };
  };

  const checkBucketExists = async (bucket: string): Promise<boolean> => {
    try {
      // Check our in-memory state first
      if (bucketState.has(bucket)) {
        const exists = bucketState.get(bucket);
        logger.info(
          bucketState.get(bucket)
            ? "Bucket already exists"
            : "Bucket does not exist",
          { bucket }
        );
        return exists || false;
      }

      // Try to check if bucket exists by making HEAD request to the bucket location
      const response = await fetch(`${minioEndpoint}/${bucket}`, {
        method: "HEAD",
        headers: createAuthHeaders("HEAD", `/${bucket}`),
      });

      if (response.ok) {
        bucketState.set(bucket, true);
        logger.info("Bucket already exists", { bucket });
        return true;
      } else if (response.status === 404) {
        bucketState.set(bucket, false);
        logger.info("Bucket does not exist", { bucket });
        return false;
      }

      // For other errors, log but don't throw - just assume bucket doesn't exist
      logger.warn("Unexpected response when checking bucket existence", {
        bucket,
        status: response.status,
      });
      bucketState.set(bucket, false);
      return false;
    } catch (error) {
      logger.warn("Error checking bucket existence", {
        bucket,
        error: error instanceof Error ? error.message : String(error),
      });
      bucketState.set(bucket, false);
      return false;
    }
  };

  const createBucket = async (bucket: string): Promise<void> => {
    logger.info("Bucket does not exist, creating...", { bucket });

    try {
      // Check if bucket already exists
      if (bucketState.get(bucket) === true) {
        throw new Error("Bucket already exists");
      }

      // Create bucket using PUT request with proper headers
      const response = await fetch(`${minioEndpoint}/${bucket}`, {
        method: "PUT",
        headers: createAuthHeaders("PUT", `/${bucket}`),
      });

      if (!response.ok) {
        throw new Error(`Failed to create bucket: ${response.status}`);
      }

      bucketState.set(bucket, true);
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
