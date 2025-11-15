import { z } from 'zod';
import { enqueueJob } from '../../shared/graphile-worker';
import { procedure, router } from '../../shared/trpc-server';
import { ResourceOwnershipEntity } from '../../permissions/resource-ownership-entity';
import { ResourceOwnershipEntityId } from '../../permissions/resource-ownership-entity-id';
import { NormalizationSessionEvent } from '../normalization-session-event/normalization-session-event';
import { NormalizationSessionEventDb } from '../normalization-session-event/normalization-session-event-db';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import { NormalizationSessionEventId } from '../normalization-session-event/normalization-session-event-id';
import { NormalizationSessionId } from '../normalization-session-id';
import {
  canViewNormalizationSession,
  getNormalizationSessionOwner,
  viewNormalizationSessionPolicy,
} from '../normalization-session-permissions';
import { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';
import { NormalizationSessionProjectionDb } from '../normalization-session-projection/normalization-session-projection-db';

export const normalizationSessionEventRouter = router({
  /**
   * Append a new event to a normalization session
   */
  append: procedure
    .input(
      z.object({
        sessionId: NormalizationSessionId.schema,
        event: NormalizationSessionEvent.schema,
      }),
    )
    .output(
      z.object({
        eventId: NormalizationSessionEventId.schema,
        projection: NormalizationSessionProjection.schema,
        event: NormalizationSessionEventEntity.schema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const eventId = NormalizationSessionEventId.generate();

      ctx.logger.info('Normalization session event append', {
        sessionId: input.sessionId,
        eventId,
        eventType: input.event.type,
        userId: ctx.userId,
      });

      const event: NormalizationSessionEventEntity = {
        id: eventId,
        normalization_session_id: input.sessionId,
        event: input.event,
        created_at: new Date(),
      };

      const projectionDb = new NormalizationSessionProjectionDb(ctx.db, ctx.logger);
      const projectionBefore = await projectionDb.load(input.sessionId, ctx.userId);

      const projection = await ctx.db.transaction(async (tx) => {
        const eventDb = new NormalizationSessionEventDb(tx, ctx.logger);
        await eventDb.append(event);

        const projectionDbTx = new NormalizationSessionProjectionDb(tx, ctx.logger);
        const projection = await projectionDbTx.refresh(input.sessionId, ctx.userId);

        if (
          NormalizationSessionProjection.shouldStartNormalizationJob(projectionBefore, projection)
        ) {
          await enqueueJob(tx, 'normalization', { sessionId: input.sessionId });
        }
        return projection;
      });

      return {
        eventId,
        projectionBefore,
        projection,
        event,
      };
    }),

  /**
   * Get all events for a normalization session
   */
  getBySessionId: procedure
    .input(
      z.object({
        id: NormalizationSessionId.schema,
      }),
    )
    .output(
      z.object({
        events: z.array(NormalizationSessionEventEntity.schema),
        resourceOwnership: z.array(ResourceOwnershipEntity.schema),
        projection: NormalizationSessionProjection.schema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      ctx.logger.info('Normalization session get events', {
        sessionId: input.id,
        userId: ctx.userId,
      });

      const permission = canViewNormalizationSession(input.id);
      const resourceOwnerId = await getNormalizationSessionOwner(ctx.db, input.id);

      if (!resourceOwnerId) {
        throw new Error('Normalization session not found');
      }

      await ctx.authorize(permission, viewNormalizationSessionPolicy, {
        resourceOwnerId,
      });

      const eventDb = new NormalizationSessionEventDb(ctx.db, ctx.logger);
      const events = await eventDb.getBySessionId(input.id);

      ctx.logger.info('Normalization session events retrieved', {
        sessionId: input.id,
        count: events.length,
      });

      const projection = await ctx.db.transaction(async (tx) => {
        const projectionDb = new NormalizationSessionProjectionDb(tx, ctx.logger);
        return await projectionDb.refresh(input.id, resourceOwnerId);
      });

      return {
        events,
        resourceOwnership: [
          {
            id: ResourceOwnershipEntityId.create('normalization-session', input.id),
            resourceType: 'normalization-session',
            resourceId: input.id,
            ownerId: resourceOwnerId,
          },
        ],
        projection,
      };
    }),
});
