import type { S3Client } from 'bun';
import type { Logger } from '../lib/logger';
import { UserId } from './user-id';
import { getProfilePictureFromS3 } from './user-profile-picture';

/**
 * Create user profile picture HTTP endpoints
 */
export function createUserProfilePictureEndpoints(config: { s3: S3Client; logger: Logger }) {
  const { s3, logger } = config;

  return {
    '/api/users/:userId/profile-picture': {
      GET: async (req: Request) => {
        try {
          // Extract userId from URL
          const url = new URL(req.url);
          const pathParts = url.pathname.split('/');
          const userIdStr = pathParts[3]; // /api/users/{userId}/profile-picture

          // Validate userId
          const parseResult = UserId.schema.safeParse(userIdStr);
          if (!parseResult.success) {
            return new Response('Invalid user ID', { status: 400 });
          }

          const userId = parseResult.data;

          // Get profile picture from S3
          const result = await getProfilePictureFromS3(s3, userId, logger);

          if (!result) {
            return new Response('Profile picture not found', { status: 404 });
          }

          // Return the image
          return new Response(new Uint8Array(result.buffer), {
            status: 200,
            headers: {
              'Content-Type': result.contentType,
              'Cache-Control': 'public, max-age=86400', // Cache for 1 day
            },
          });
        } catch (error) {
          logger.error('Error serving profile picture', { error });
          return new Response('Internal server error', { status: 500 });
        }
      },
    },
  };
}
