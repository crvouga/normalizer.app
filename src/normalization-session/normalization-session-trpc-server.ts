import { eq } from 'drizzle-orm';
import { z } from 'zod';
import * as schema from '../db/schema';
import { procedure, router } from '../lib/trpc-server';
import { NormalizationSessionEventId } from './normalization-session-event-id';
import { NormalizationSessionId } from './normalization-session-id';
import { NormalizationSessionEvent } from './normalization-session-event';
import { NormalizationSessionEventEntity } from './normalization-session-event-entity';
import { NormalizationSessionProjection } from './normalization-session-projection';

export const normalizationSessionRouter = router({
  /**
   * Append a new event to a normalization session
   */
  appendEvent: procedure
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

      await ctx.db.insert(schema.normalizationSessionEvents).values({
        id: eventId,
        normalization_session_id: input.sessionId,
        event: input.event,
        created_at: new Date(),
      });

      return {
        eventId,
      };
    }),

  /**
   * Get all events for a normalization session
   */
  getEvents: procedure
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

  /**
   * Get the current projected state of a normalization session
   */
  getSession: procedure
    .input(
      z.object({
        sessionId: NormalizationSessionId.schema,
      }),
    )
    .output(NormalizationSessionProjection.schema.nullable())
    .mutation(async ({ input, ctx }) => {
      ctx.logger.info('Normalization session get projection', {
        sessionId: input.sessionId,
        userId: ctx.userId,
      });

      const events = await ctx.db
        .select()
        .from(schema.normalizationSessionEvents)
        .where(eq(schema.normalizationSessionEvents.normalization_session_id, input.sessionId))
        .orderBy(schema.normalizationSessionEvents.created_at);

      if (events.length === 0) {
        ctx.logger.info('Normalization session not found', {
          sessionId: input.sessionId,
        });
        return null;
      }

      // Validate events
      const validatedEvents = z.array(NormalizationSessionEventEntity.schema).parse(events);

      // Project the state by reducing all events
      const initialState: NormalizationSessionProjection = {
        id: input.sessionId,
        targetArtifactIds: [],
        startedAt: new Date(),
        startedByUserId: ctx.userId,
      };

      const projection = validatedEvents.reduce((state, eventEntity) => {
        return NormalizationSessionProjection.reducer(state, eventEntity.event);
      }, initialState);

      ctx.logger.info('Normalization session projection computed', {
        sessionId: input.sessionId,
        eventCount: events.length,
      });

      return projection;
    }),
});
