import { eq } from 'drizzle-orm';
import { z } from 'zod';
import * as schema from '../../db/schema';
import { procedure, router } from '../../lib/trpc-server';
import { ResourceOwnershipEntity } from '../../permissions/resource-ownership-entity';
import { ResourceOwnershipEntityId } from '../../permissions/resource-ownership-entity-id';
import { NormalizationSessionEvent } from '../normalization-session-event/normalization-session-event';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import { NormalizationSessionEventId } from '../normalization-session-event/normalization-session-event-id';
import { NormalizationSessionId } from '../normalization-session-id';
import {
  canViewNormalizationSession,
  getNormalizationSessionOwner,
  viewNormalizationSessionPolicy,
} from '../normalization-session-permissions';
import { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';
import { loadNormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection-load';
import { refreshNormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection-refresh';

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
      const params = {
        tx: ctx.db,
        sessionId: input.sessionId,
        startedByUserId: ctx.userId,
        logger: ctx.logger,
      };

      const projectionBefore = await loadNormalizationSessionProjection(params);

      const projection = await ctx.db.transaction(async (tx) => {
        await tx.insert(schema.normalizationSessionEvents).values(event);
        const projection = await refreshNormalizationSessionProjection({ ...params, tx });

        if (NormalizationSessionProjection.shouldStartNormalization(projectionBefore, projection)) {
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

      const events = await ctx.db
        .select()
        .from(schema.normalizationSessionEvents)
        .where(eq(schema.normalizationSessionEvents.normalization_session_id, input.id))
        .orderBy(schema.normalizationSessionEvents.created_at);

      ctx.logger.info('Normalization session events retrieved', {
        sessionId: input.id,
        count: events.length,
      });

      const validatedEvents = z.array(NormalizationSessionEventEntity.schema).parse(events);

      const projection = await ctx.db.transaction(
        async (tx) =>
          await refreshNormalizationSessionProjection({
            tx,
            sessionId: input.id,
            startedByUserId: resourceOwnerId,
            logger: ctx.logger,
          }),
      );

      return {
        events: validatedEvents,
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
