import { z } from 'zod';
import { zAsyncIterable } from '~/src/lib/zod-async-iterable';
import { AppNotification } from '~/src/shared/app-notification';
import { type Context, procedure, router } from '~/src/shared/trpc-server';
import { NormalizationRunId } from '../normalization-run-id';
import { WorkspaceId } from '../workspace-id';
import { canViewWorkspace, viewWorkspacePolicy } from '../workspace-permissions';
import { WorkspaceProjectionDb } from '../workspace-projection/workspace-projection-db';
import { NormalizationLog } from './normalization-log';
import { createNormalizationLogDb } from './normalization-log-db';

const logsInputSchema = z.object({
  workspaceId: WorkspaceId.schema,
  normalizationRunId: NormalizationRunId.schema,
  afterSeq: z.number().optional(),
});

const logsBatchSchema = z.array(NormalizationLog.schema);

async function authorizeWorkspaceView(ctx: Context, workspaceId: WorkspaceId) {
  const permission = canViewWorkspace(workspaceId);
  const projectionDb = new WorkspaceProjectionDb(ctx.db, ctx.logger);
  const resourceOwnerId = await projectionDb.getOwner(workspaceId);

  if (!resourceOwnerId) {
    throw new Error('Workspace not found');
  }

  await ctx.authorize(permission, viewWorkspacePolicy, { resourceOwnerId });
}

export const normalizationLogRouter = router({
  fetch: procedure
    .input(logsInputSchema)
    .output(logsBatchSchema)
    .query(async ({ input, ctx }) => {
      await authorizeWorkspaceView(ctx, input.workspaceId);

      const logDb = createNormalizationLogDb({ db: ctx.db, logger: ctx.logger });
      return logDb.listAfter({
        workspaceId: input.workspaceId,
        normalizationRunId: input.normalizationRunId,
        ...(input.afterSeq !== undefined ? { afterSeq: input.afterSeq } : {}),
      });
    }),

  subscribe: procedure
    .input(
      z.object({
        workspaceId: WorkspaceId.schema,
        normalizationRunId: NormalizationRunId.schema,
      }),
    )
    .output(
      zAsyncIterable({
        yield: logsBatchSchema,
      }),
    )
    .subscription(async function* ({ input, ctx }) {
      await authorizeWorkspaceView(ctx, input.workspaceId);

      const logDb = createNormalizationLogDb({ db: ctx.db, logger: ctx.logger });
      let lastSeq = 0;

      const initialLogs = await logDb.listAfter({
        workspaceId: input.workspaceId,
        normalizationRunId: input.normalizationRunId,
      });

      if (initialLogs.length > 0) {
        lastSeq = initialLogs[initialLogs.length - 1]!.seq;
        yield initialLogs;
      }

      ctx.logger.info('Normalization log subscription started', {
        workspaceId: input.workspaceId,
        normalizationRunId: input.normalizationRunId,
        userId: ctx.userId,
      });

      const appNotification = new AppNotification(ctx.db);

      try {
        const notifications = appNotification.subscribe('normalization_log');

        for await (const notifiedWorkspaceId of notifications) {
          if (notifiedWorkspaceId !== input.workspaceId) {
            continue;
          }

          const newLogs = await logDb.listAfter({
            workspaceId: input.workspaceId,
            normalizationRunId: input.normalizationRunId,
            afterSeq: lastSeq,
          });

          if (newLogs.length === 0) {
            continue;
          }

          lastSeq = newLogs[newLogs.length - 1]!.seq;
          yield newLogs;
        }
      } finally {
        ctx.logger.info('Normalization log subscription ended', {
          workspaceId: input.workspaceId,
          normalizationRunId: input.normalizationRunId,
          userId: ctx.userId,
        });
      }
    }),
});
