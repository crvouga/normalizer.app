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
  const createAuthHeaders = (
    bucket: string,
    method: string = "HEAD"
  ): Headers => {
    const headers = new Headers();
    const dateString = new Date().toUTCString();
    headers.set("Date", dateString);
    headers.set("Host", new URL(minioEndpoint).host);

    // For MinIO, we can use a simpler approach with basic auth for development
    // In production, you'd want to implement proper AWS Signature Version 4
    const credentials = btoa(`${accessKey}:${secretKey}`);
    headers.set("Authorization", `Basic ${credentials}`);
    return headers;
  };

  const checkBucketExists = async (bucket: string): Promise<boolean> => {
    const url = `${minioEndpoint}/${bucket}`;
    const headers = createAuthHeaders(bucket);

    const checkResponse = await fetch(url, {
      method: "HEAD",
      headers,
    });

    if (checkResponse.ok) {
      logger.info("Bucket already exists", { bucket });
      return true;
    }

    if (checkResponse.status !== 404) {
      logger.error("Failed to check bucket existence", {
        bucket,
        status: checkResponse.status,
        statusText: checkResponse.statusText,
      });
      throw new Error(
        `Failed to check bucket existence: ${checkResponse.statusText}`
      );
    }

    return false;
  };

  const createBucket = async (bucket: string): Promise<void> => {
    const url = `${minioEndpoint}/${bucket}`;
    const headers = createAuthHeaders(bucket);

    logger.info("Bucket does not exist, creating...", { bucket });

    const createResponse = await fetch(url, {
      method: "PUT",
      headers,
    });

    if (!createResponse.ok) {
      logger.error("Failed to create bucket", {
        bucket,
        status: createResponse.status,
        statusText: createResponse.statusText,
      });
      throw new Error(`Failed to create bucket: ${createResponse.statusText}`);
    }

    logger.info("Successfully created bucket", { bucket });
  };

  const ensureBucketExists = async (bucket: string): Promise<void> => {
    logger.info("Checking if bucket exists...", { bucket });

    try {
      const exists = await checkBucketExists(bucket);
      if (!exists) {
        await createBucket(bucket);
      }
    } catch (error) {
      logger.error("Error ensuring bucket exists", { bucket, error });
      throw error;
    }
  };

  return {
    checkBucketExists,
    createBucket,
    ensureBucketExists,
  };
};
