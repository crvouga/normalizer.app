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
  const checkBucketExists = async (bucket: string): Promise<boolean> => {
    // Use S3-compatible API to check if bucket exists
    const s3Url = `${minioEndpoint}/${bucket}`;
    const s3Headers = new Headers();
    s3Headers.set("Host", new URL(minioEndpoint).host);

    try {
      const checkResponse = await fetch(s3Url, {
        method: "HEAD",
        headers: s3Headers,
      });

      if (checkResponse.ok) {
        logger.info("Bucket already exists", { bucket });
        return true;
      }

      if (checkResponse.status === 404) {
        logger.info("Bucket does not exist", { bucket });
        return false;
      }

      // For other errors, log but don't throw - just assume bucket doesn't exist
      logger.warn("Unexpected response when checking bucket existence", {
        bucket,
        status: checkResponse.status,
        statusText: checkResponse.statusText,
      });
      return false;
    } catch (error) {
      logger.warn(
        "Error checking bucket existence, assuming it doesn't exist",
        {
          bucket,
          error: error instanceof Error ? error.message : String(error),
        }
      );
      return false;
    }
  };

  const createBucket = async (bucket: string): Promise<void> => {
    logger.info("Bucket does not exist, creating...", { bucket });

    try {
      // Use S3-compatible API to create bucket
      const s3Url = `${minioEndpoint}/${bucket}`;
      const s3Headers = new Headers();
      s3Headers.set("Host", new URL(minioEndpoint).host);

      const createResponse = await fetch(s3Url, {
        method: "PUT",
        headers: s3Headers,
      });

      if (!createResponse.ok) {
        logger.error("Failed to create bucket", {
          bucket,
          status: createResponse.status,
          statusText: createResponse.statusText,
        });
        throw new Error(
          `Failed to create bucket: ${createResponse.statusText}`
        );
      }

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
