import { S3Client } from "bun";
import type { Logger } from "./lib/logger";
import { createMinioClient } from "./lib/minio/minio-client";
import { getS3Config } from "./s3-config";

// Create a wrapper around S3Client that supports external endpoints for presigned URLs
class S3ClientWithExternalEndpoint extends S3Client {
  private externalEndpoint: string;

  constructor(config: any, externalEndpoint: string) {
    super(config);
    this.externalEndpoint = externalEndpoint;
  }

  presign(key: string): string {
    const presignedUrl = super.presign(key);
    // Replace the internal endpoint with the external endpoint
    const url = new URL(presignedUrl);
    const externalUrl = new URL(this.externalEndpoint);
    url.hostname = externalUrl.hostname;
    url.port = externalUrl.port;
    url.protocol = externalUrl.protocol;
    return url.toString();
  }
}

export const createS3 = async ({
  logger,
}: {
  logger: Logger;
}): Promise<S3Client> => {
  const {
    s3Endpoint,
    s3ExternalEndpoint,
    s3AccessKeyId,
    s3SecretAccessKey,
    s3Bucket,
  } = getS3Config();

  logger.info("Initializing S3 client...");
  try {
    const s3Client = new S3ClientWithExternalEndpoint(
      {
        endpoint: s3Endpoint,
        accessKeyId: s3AccessKeyId,
        secretAccessKey: s3SecretAccessKey,
      },
      s3ExternalEndpoint
    );

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
