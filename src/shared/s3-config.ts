import { parseAndValidateURL } from '../lib/url';

export const getS3Config = () => {
  const s3EndpointEnv = process.env.S3_ENDPOINT;
  if (!s3EndpointEnv) {
    throw new Error('S3_ENDPOINT environment variable is not set');
  }
  const s3Endpoint = parseAndValidateURL(s3EndpointEnv, 'Invalid S3_ENDPOINT');
  const s3AccessKeyId = process.env.S3_ACCESS_KEY;
  if (!s3AccessKeyId) {
    throw new Error('S3_ACCESS_KEY environment variable is not set');
  }
  const s3SecretAccessKey = process.env.S3_SECRET_KEY;
  if (!s3SecretAccessKey) {
    throw new Error('S3_SECRET_KEY environment variable is not set');
  }
  const s3Bucket = process.env.S3_BUCKET;
  if (!s3Bucket) {
    throw new Error('S3_BUCKET environment variable is not set');
  }
  return {
    s3Endpoint,
    s3AccessKeyId,
    s3SecretAccessKey,
    s3Bucket,
  };
};
