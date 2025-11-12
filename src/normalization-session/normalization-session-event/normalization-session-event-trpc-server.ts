import { eq } from 'drizzle-orm';
import { z } from 'zod';
import * as schema from '../../db/schema';
import { procedure, router } from '../../lib/trpc-server';
import { NormalizationSessionEvent } from '../normalization-session-event/normalization-session-event';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import { NormalizationSessionEventId } from '../normalization-session-event/normalization-session-event-id';
import { NormalizationSessionId } from '../normalization-session-id';
import { refreshNormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection-refresh';
import {
  canViewNormalizationSession,
  canEditNormalizationSession,
  canDeleteNormalizationSession,
  viewNormalizationSessionPolicy,
  editNormalizationSessionPolicy,
  deleteNormalizationSessionPolicy,
  getNormalizationSessionOwner,
} from '../normalization-session-permissions';
import { isGranted } from '../../permissions/permission';

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
    .mutation(async ({ input, ctx }) => {
      const eventId = NormalizationSessionEventId.generate();

      ctx.logger.info('Normalization session event append', {
        sessionId: input.sessionId,
        eventId,
        eventType: input.event.type,
        userId: ctx.userId,
      });

      const projection = await ctx.db.transaction(async (tx) => {
        // Insert the new event
        await tx.insert(schema.normalizationSessionEvents).values({
          id: eventId,
          normalization_session_id: input.sessionId,
          event: input.event,
          created_at: new Date(),
        });

        // Refresh the projection
        return await refreshNormalizationSessionProjection({
          tx: tx,
          sessionId: input.sessionId,
          startedByUserId: ctx.userId,
          logger: ctx.logger,
        });
      });

      return {
        eventId,
        projection,
      };
    }),

  /**
   * Get all events for a normalization session
   */
  getBySessionId: procedure
    .input(
      z.object({
        sessionId: NormalizationSessionId.schema,
      }),
    )
    .output(
      z.object({
        events: z.array(NormalizationSessionEventEntity.schema),
        permissions: z.object({
          canView: z.boolean(),
          canEdit: z.boolean(),
          canDelete: z.boolean(),
          resourceOwnerId: z.string(),
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      ctx.logger.info('Normalization session get events', {
        sessionId: input.sessionId,
        userId: ctx.userId,
      });

      // Authorization check: verify user has permission to view this session
      const permission = canViewNormalizationSession(input.sessionId);
      const resourceOwnerId = await getNormalizationSessionOwner(ctx.db, input.sessionId);

      if (!resourceOwnerId) {
        throw new Error('Normalization session not found');
      }

      await ctx.authorize(permission, viewNormalizationSessionPolicy, {
        resourceOwnerId,
      });

      const events = await ctx.db
        .select()
        .from(schema.normalizationSessionEvents)
        .where(eq(schema.normalizationSessionEvents.normalization_session_id, input.sessionId))
        .orderBy(schema.normalizationSessionEvents.created_at);

      ctx.logger.info('Normalization session events retrieved', {
        sessionId: input.sessionId,
        count: events.length,
      });

      // Calculate all permissions for this session
      const viewPermission = canViewNormalizationSession(input.sessionId);
      const editPermission = canEditNormalizationSession(input.sessionId);
      const deletePermission = canDeleteNormalizationSession(input.sessionId);

      const viewResult = await ctx.checkPermission(viewPermission, viewNormalizationSessionPolicy, {
        resourceOwnerId,
      });
      const editResult = await ctx.checkPermission(editPermission, editNormalizationSessionPolicy, {
        resourceOwnerId,
      });
      const deleteResult = await ctx.checkPermission(
        deletePermission,
        deleteNormalizationSessionPolicy,
        {
          resourceOwnerId,
        },
      );

      // Validate and transform to NormalizationSessionEventEntity type array
      const validatedEvents = z.array(NormalizationSessionEventEntity.schema).parse(events);

      return {
        events: validatedEvents,
        permissions: {
          canView: isGranted(viewResult),
          canEdit: isGranted(editResult),
          canDelete: isGranted(deleteResult),
          resourceOwnerId,
        },
      };
    }),
});
