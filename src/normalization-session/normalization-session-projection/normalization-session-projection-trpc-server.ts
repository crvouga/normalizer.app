import { z } from 'zod';
import type { Logger } from '~/src/lib/logger';
import { AppNotification } from '~/src/shared/app-notification';
import type { Db, Tx } from '~/src/shared/sql';
import { procedure, router } from '~/src/shared/trpc-server';
import type { UserId } from '~/src/users/user-id';
import { NormalizationSessionId } from '../normalization-session-id';
import {
  canViewNormalizationSession,
  getNormalizationSessionOwner,
  viewNormalizationSessionPolicy,
} from '../normalization-session-permissions';
import { NormalizationSessionProjection } from './normalization-session-projection';
import { NormalizationSessionProjectionDb } from './normalization-session-projection-db';
import { zAsyncIterable } from '~/src/lib/zod-async-iterable';

export const normalizationSessionProjectionRouter = router({
  subscribe: procedure
    .input(
      z.object({
        id: NormalizationSessionId.schema,
      }),
    )
    .output(
      zAsyncIterable({ yield: z.object({ projection: NormalizationSessionProjection.schema }) }),
    )
    .subscription(async function* ({ input, ctx }) {
      const { id: sessionId } = input;
      const permission = canViewNormalizationSession(sessionId);
      const resourceOwnerId = await getNormalizationSessionOwner(ctx.db, sessionId);

      if (!resourceOwnerId) throw new Error('Normalization session not found');

      await ctx.authorize(permission, viewNormalizationSessionPolicy, { resourceOwnerId });

      ctx.logger.info('Normalization session projection subscription started', {
        sessionId,
        userId: ctx.userId,
      });

      const projection = await loadProjection(ctx.db, ctx.logger, sessionId, resourceOwnerId);
      if (!projection) throw new Error('Failed to load initial projection');

      yield { projection };

      const appNotification = new AppNotification(ctx.db);

      try {
        const notifications = appNotification.subscribe('normalization_session_projection_update');

        for await (const notifiedSessionId of notifications) {
          if (notifiedSessionId !== sessionId) continue;

          const projection = await loadProjection(ctx.db, ctx.logger, sessionId, resourceOwnerId);

          if (!projection) continue;

          yield { projection };
        }
      } finally {
        ctx.logger.info('Normalization session projection subscription ended', {
          sessionId,
          userId: ctx.userId,
        });
      }
    }),
});

const loadProjection = async (
  db: Db | Tx,
  logger: Logger,
  sessionId: NormalizationSessionId,
  ownerId: UserId,
): Promise<NormalizationSessionProjection | null> => {
  try {
    const projectionDb = new NormalizationSessionProjectionDb(db, logger);
    return projectionDb.load(sessionId, ownerId);
  } catch (error) {
    logger.error('Failed to load projection', {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};
