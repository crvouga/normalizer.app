import type { ObjectStore } from '../lib/object-store/object-store';
import type { Logger } from '../lib/logger';
import type { UserId } from './user-id';
import { isOk } from '../lib/result';
import { getS3Config } from '../shared/s3-config';

const PROFILE_PICTURES_PREFIX = 'profile-pictures';

/**
 * Generate S3 key for a user's profile picture
 */
function getProfilePictureS3Key(userId: UserId, extension: string = 'jpg'): string {
  return `${PROFILE_PICTURES_PREFIX}/${userId}.${extension}`;
}

/**
 * Generate URL for serving a user's profile picture from our server
 */
export function getProfilePictureUrl(userId: UserId, _s3Endpoint: string): string {
  // Using our server endpoint to serve profile pictures
  return `/api/users/${userId}/profile-picture`;
}

/**
 * Download an image from a URL and return the buffer
 */
async function downloadImage(
  url: string,
  logger: Logger,
): Promise<{ buffer: Buffer; contentType: string }> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return { buffer, contentType };
  } catch (error) {
    logger.error('Failed to download profile picture', { url, error });
    throw error;
  }
}

/**
 * Upload profile picture to S3
 */
async function uploadProfilePictureToS3(params: {
  objectStore: ObjectStore;
  userId: UserId;
  buffer: Buffer;
  contentType: string;
  logger: Logger;
}): Promise<string> {
  const { objectStore, userId, buffer, contentType, logger } = params;
  // Determine file extension from content type
  const extension = contentType.includes('png') ? 'png' : 'jpg';
  const s3Key = getProfilePictureS3Key(userId, extension);
  const { s3Bucket } = getS3Config();

  try {
    const result = await objectStore.write({
      bucket: s3Bucket,
      key: s3Key,
      data: buffer,
      contentType,
    });

    if (!isOk(result)) {
      throw new Error(`Failed to upload profile picture: ${result.error}`);
    }

    logger.info('Uploaded profile picture to S3', {
      user_id: userId,
      s3_key: s3Key,
      size: buffer.length,
    });

    return s3Key;
  } catch (error) {
    logger.error('Failed to upload profile picture to S3', {
      user_id: userId,
      s3_key: s3Key,
      error,
    });
    throw error;
  }
}

/**
 * Download a profile picture from an external URL and store it in S3
 * Returns the URL to serve the profile picture from our server
 */
export async function storeProfilePictureFromUrl(params: {
  objectStore: ObjectStore;
  userId: UserId;
  externalUrl: string;
  s3Endpoint: string;
  logger: Logger;
}): Promise<string> {
  const { objectStore, userId, externalUrl, s3Endpoint, logger } = params;
  try {
    // Download the image
    const { buffer, contentType } = await downloadImage(externalUrl, logger);

    // Upload to S3
    await uploadProfilePictureToS3({ objectStore, userId, buffer, contentType, logger });

    // Return our server URL for serving the image
    return getProfilePictureUrl(userId, s3Endpoint);
  } catch (error) {
    logger.error('Failed to store profile picture', {
      user_id: userId,
      external_url: externalUrl,
      error,
    });
    // Return the external URL as fallback
    return externalUrl;
  }
}

/**
 * Get profile picture from S3
 */
export async function getProfilePictureFromS3(
  objectStore: ObjectStore,
  userId: UserId,
  logger: Logger,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  // Try both jpg and png extensions
  const extensions = ['jpg', 'png'];
  const { s3Bucket } = getS3Config();

  for (const extension of extensions) {
    const s3Key = getProfilePictureS3Key(userId, extension);

    try {
      const existsResult = await objectStore.exists({ bucket: s3Bucket, key: s3Key });
      if (isOk(existsResult) && existsResult.value) {
        const readResult = await objectStore.read({ bucket: s3Bucket, key: s3Key });
        if (isOk(readResult)) {
          const buffer = readResult.value;
          const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';

          return { buffer, contentType };
        }
      }
    } catch (error) {
      // Continue to next extension
      logger.debug('Profile picture not found with extension', {
        user_id: userId,
        extension,
      });
    }
  }

  logger.warn('Profile picture not found in S3', { user_id: userId });
  return null;
}

/**
 * Delete profile picture from S3
 */
export async function deleteProfilePicture(
  objectStore: ObjectStore,
  userId: UserId,
  logger: Logger,
): Promise<void> {
  const extensions = ['jpg', 'png'];
  const { s3Bucket } = getS3Config();

  for (const extension of extensions) {
    const s3Key = getProfilePictureS3Key(userId, extension);

    try {
      const result = await objectStore.delete({ bucket: s3Bucket, key: s3Key });
      if (isOk(result)) {
        logger.info('Deleted profile picture from S3', {
          user_id: userId,
          s3_key: s3Key,
        });
      }
    } catch (error) {
      // Ignore errors - file might not exist
      logger.debug('Failed to delete profile picture (might not exist)', {
        user_id: userId,
        s3_key: s3Key,
      });
    }
  }
}
