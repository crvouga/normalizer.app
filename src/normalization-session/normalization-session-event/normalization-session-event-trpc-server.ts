import { eq } from 'drizzle-orm';
import { z } from 'zod';
import * as schema from '../../db/schema';
import { procedure, router } from '../../lib/trpc-server';
import { NormalizationSessionEvent } from '../normalization-session-event/normalization-session-event';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import { NormalizationSessionEventId } from '../normalization-session-event/normalization-session-event-id';
import { NormalizationSessionId } from '../normalization-session-id';
import { NormalizationSessionProjection } from '../normalization-session-projection';

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

      await ctx.db.transaction(async (tx) => {
        // Insert the new event
        await tx.insert(schema.normalizationSessionEvents).values({
          id: eventId,
          normalization_session_id: input.sessionId,
          event: input.event,
          created_at: new Date(),
        });

        // Query all events for this session (including the new one)
        const events = await tx
          .select()
          .from(schema.normalizationSessionEvents)
          .where(eq(schema.normalizationSessionEvents.normalization_session_id, input.sessionId))
          .orderBy(schema.normalizationSessionEvents.created_at);

        // Validate events
        const validatedEvents = z.array(NormalizationSessionEventEntity.schema).parse(events);

        // Compute projection by reducing all events
        const initialState = NormalizationSessionProjection.init({
          sessionId: input.sessionId,
          targetArtifactIds: [],
          startedAt: new Date(),
          startedByUserId: ctx.userId,
        });
        const projection = NormalizationSessionProjection.reduce(validatedEvents, initialState);

        // Upsert the projection for this normalization session
        await tx
          .insert(schema.normalizationSessionProjections)
          .values({
            normalization_session_id: projection.id,
            projection: projection,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.normalizationSessionProjections.normalization_session_id,
            set: {
              projection: projection,
              updated_at: new Date(),
            },
          });

        ctx.logger.info('Normalization session projection updated', {
          sessionId: input.sessionId,
          eventCount: events.length,
        });
      });

      return {
        eventId,
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
    .output(z.array(NormalizationSessionEventEntity.schema))
    .mutation(async ({ input, ctx }) => {
      ctx.logger.info('Normalization session get events', {
        sessionId: input.sessionId,
        userId: ctx.userId,
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

      // Validate and transform to NormalizationSessionEventEntity type array
      return z.array(NormalizationSessionEventEntity.schema).parse(events);
    }),
});
