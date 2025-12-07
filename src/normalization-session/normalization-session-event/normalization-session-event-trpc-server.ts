import { z } from 'zod';
import { createArtifactDb } from '~/src/artifacts/artifact-db';
import { ResourceOwnershipEntity } from '~/src/permissions/resource-ownership-entity';
import { ResourceOwnershipEntityId } from '~/src/permissions/resource-ownership-entity-id';
import { enqueueJob } from '../../shared/graphile-worker';
import { procedure, router } from '../../shared/trpc-server';
import { NormalizationSessionEvent } from '../normalization-session-event/normalization-session-event';
import { createNormalizationSessionEventDb } from '../normalization-session-event/normalization-session-event-db';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import { NormalizationSessionEventId } from '../normalization-session-event/normalization-session-event-id';
import { NormalizationSessionId } from '../normalization-session-id';
import { NormalizationSessionPayload } from '../normalization-session-payload/normalization-session-payload';
import { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';
import { createNormalizationSessionProjectionDb } from '../normalization-session-projection/normalization-session-projection-db';

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
    .output(NormalizationSessionPayload.schema)
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
        const projectionDb = createNormalizationSessionProjectionDb({ tx, logger: ctx.logger });
        const projectionBefore = await projectionDb.load(input.sessionId, ctx.userId);
        const eventDb = createNormalizationSessionEventDb({ tx, logger: ctx.logger });
        await eventDb.append(event);
        const projection = await projectionDb.refresh(input.sessionId, ctx.userId);
        if (
          NormalizationSessionProjection.shouldStartNormalizationJob(projectionBefore, projection)
        ) {
          await enqueueJob(tx, 'normalization', { sessionId: input.sessionId });
        }
      });
      // After commit, load full payload to return
      const projectionDb = createNormalizationSessionProjectionDb({
        tx: ctx.db,
        logger: ctx.logger,
      });
      const ownerId = await projectionDb.getOwner(input.sessionId);
      if (!ownerId) {
        throw new Error('Normalization session not found');
      }
      const eventsDb = createNormalizationSessionEventDb({ tx: ctx.db, logger: ctx.logger });
      const events = await eventsDb.getBySessionId(input.sessionId);
      const projection = await projectionDb.load(input.sessionId, ownerId);
      const artifactIds = NormalizationSessionProjection.toArtifactIds(projection);
      const artifactDb = createArtifactDb({ tx: ctx.db, logger: ctx.logger });
      const artifacts = await artifactDb.getRefreshed(artifactIds, ctx.objectStore);

      const resourceOwnership: ResourceOwnershipEntity[] = [
        {
          id: ResourceOwnershipEntityId.create('normalization-session', input.sessionId),
          resourceType: 'normalization-session',
          resourceId: input.sessionId,
          ownerId,
        },
      ];
      const payload: NormalizationSessionPayload = {
        sessionEvents: events,
        sessionProjections: [projection],
        artifacts,
        resourceOwnership,
      };
      return payload;
    }),
});
