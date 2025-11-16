import { z } from 'zod';
import { enqueueJob } from '../../shared/graphile-worker';
import { procedure, router } from '../../shared/trpc-server';
import { NormalizationSessionEvent } from '../normalization-session-event/normalization-session-event';
import { NormalizationSessionEventDb } from '../normalization-session-event/normalization-session-event-db';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import { NormalizationSessionEventId } from '../normalization-session-event/normalization-session-event-id';
import { NormalizationSessionId } from '../normalization-session-id';
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
      await ctx.db.transaction(async (tx) => {
        const projectionDb = new NormalizationSessionProjectionDb(tx, ctx.logger);
        const projectionBefore = await projectionDb.load(input.sessionId, ctx.userId);
        const eventDb = new NormalizationSessionEventDb(tx, ctx.logger);
        await eventDb.append(event);
        const projection = await projectionDb.refresh(input.sessionId, ctx.userId);
        if (
          NormalizationSessionProjection.shouldStartNormalizationJob(projectionBefore, projection)
        ) {
          await enqueueJob(tx, 'normalization', { sessionId: input.sessionId });
        }
      });
    }),
});
