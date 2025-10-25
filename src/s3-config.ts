export const getS3Config = () => {
  const s3Endpoint = process.env.S3_ENDPOINT;
  if (!s3Endpoint) {
    throw new Error("S3_ENDPOINT environment variable is not set");
  }
  const s3ExternalEndpoint = process.env.S3_EXTERNAL_ENDPOINT || s3Endpoint;
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
    s3ExternalEndpoint,
    s3AccessKeyId,
    s3SecretAccessKey,
    s3Bucket,
  };
};
