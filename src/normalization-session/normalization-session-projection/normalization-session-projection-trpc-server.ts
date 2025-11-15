import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { procedure, router } from '~/src/shared/trpc-server';
import * as schema from '../../db/schema';
import {
  canViewNormalizationSession,
  getNormalizationSessionOwner,
  viewNormalizationSessionPolicy,
} from '../normalization-session-permissions';
import { NormalizationSessionId } from '../normalization-session-id';
import { NormalizationSessionProjectionDb } from './normalization-session-projection-db';

export const normalizationSessionProjectionRouter = router({
  /**
   * Subscribe to normalization session projection updates by ID
   * Uses Server-Sent Events (SSE) to stream updates in real-time
   */
  subscribe: procedure
    .input(
      z.object({
        id: NormalizationSessionId.schema,
      }),
    )
    .subscription(async function* ({ input, ctx }) {
      const { id: sessionId } = input;

      // Check permissions
      const permission = canViewNormalizationSession(sessionId);
      const resourceOwnerId = await getNormalizationSessionOwner(ctx.db, sessionId);

      if (!resourceOwnerId) {
        throw new Error('Normalization session not found');
      }

      await ctx.authorize(permission, viewNormalizationSessionPolicy, {
        resourceOwnerId,
      });

      ctx.logger.info('Normalization session projection subscription started', {
        sessionId,
        userId: ctx.userId,
      });

      // Load and yield initial projection
      let lastUpdatedAt: number;
      try {
        const projectionDb = new NormalizationSessionProjectionDb(ctx.db, ctx.logger);
        const initialProjection = await projectionDb.load(sessionId, resourceOwnerId);
        lastUpdatedAt = initialProjection.lastUpdatedAt.getTime();
        yield initialProjection;
      } catch (error) {
        ctx.logger.error('Failed to load initial projection for subscription', {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error instanceof Error ? error : new Error('Failed to load projection');
      }

      // Poll for projection updates by checking the database table's updated_at timestamp
      // This approach works across all replicas behind a load balancer
      // since we query the shared database directly rather than relying on in-memory events
      let isActive = true;

      try {
        while (isActive) {
          // Poll every 500ms to check for updates
          await new Promise<void>((resolve) => setTimeout(resolve, 500));

          if (!isActive) {
            break;
          }

          try {
            // Check the database table's updated_at timestamp
            // This is more efficient than recomputing the projection each time
            const projectionRow = await ctx.db
              .select({
                updated_at: schema.normalizationSessionProjections.updated_at,
              })
              .from(schema.normalizationSessionProjections)
              .where(eq(schema.normalizationSessionProjections.normalization_session_id, sessionId))
              .limit(1);

            // If the projection row exists and was updated, load and yield it
            const projectionData = projectionRow[0];
            if (projectionData?.updated_at) {
              const dbUpdatedAt = projectionData.updated_at.getTime();
              if (dbUpdatedAt > lastUpdatedAt) {
                lastUpdatedAt = dbUpdatedAt;
                const projectionDb = new NormalizationSessionProjectionDb(ctx.db, ctx.logger);
                const currentProjection = await projectionDb.load(sessionId, resourceOwnerId);
                yield currentProjection;
              }
            }
          } catch (error) {
            ctx.logger.error('Failed to check for projection updates', {
              sessionId,
              error: error instanceof Error ? error.message : String(error),
            });
            // Don't throw on update failure, just log it and continue polling
          }
        }
      } finally {
        // Cleanup on unsubscribe
        isActive = false;
        ctx.logger.info('Normalization session projection subscription ended', {
          sessionId,
          userId: ctx.userId,
        });
      }
    }),
});
