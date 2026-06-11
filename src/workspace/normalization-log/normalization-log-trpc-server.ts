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

const POLL_INTERVAL_MS = 500;

async function authorizeWorkspaceView(ctx: Context, workspaceId: WorkspaceId) {
  const permission = canViewWorkspace(workspaceId);
  const projectionDb = new WorkspaceProjectionDb(ctx.db, ctx.logger);
  const resourceOwnerId = await projectionDb.getOwner(workspaceId);

  if (!resourceOwnerId) {
    throw new Error('Workspace not found');
  }

  await ctx.authorize(permission, viewWorkspacePolicy, { resourceOwnerId });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const normalizationLogRouter = router({
  fetch: procedure
    .input(logsInputSchema)
    .output(logsBatchSchema)
    .query(async ({ input, ctx }) => {
      await authorizeWorkspaceView(ctx, input.workspaceId);

      const logDb = createNormalizationLogDb({ db: ctx.db });
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

      const logDb = createNormalizationLogDb({ db: ctx.db });
      let lastSeq = 0;

      const loadNewLogs = async () => {
        const logs = await logDb.listAfter({
          workspaceId: input.workspaceId,
          normalizationRunId: input.normalizationRunId,
          ...(lastSeq > 0 ? { afterSeq: lastSeq } : {}),
        });

        if (logs.length > 0) {
          lastSeq = logs[logs.length - 1]!.seq;
        }

        return logs;
      };

      const initialLogs = await loadNewLogs();
      if (initialLogs.length > 0) {
        yield initialLogs;
      }

      ctx.logger.info('Normalization log subscription started', {
        workspaceId: input.workspaceId,
        normalizationRunId: input.normalizationRunId,
        userId: ctx.userId,
      });

      const appNotification = new AppNotification(ctx.db);
      const notifications = appNotification.subscribe('normalization_log');
      let pendingNotification: ReturnType<typeof notifications.next> | null = null;

      try {
        while (true) {
          if (!pendingNotification) {
            pendingNotification = notifications.next();
          }

          const raced = await Promise.race([
            pendingNotification.then((result) => {
              pendingNotification = null;
              return { kind: 'notify' as const, result };
            }),
            sleep(POLL_INTERVAL_MS).then(() => ({ kind: 'poll' as const })),
          ]);

          if (raced.kind === 'notify') {
            if (raced.result.done) {
              break;
            }

            const notifiedWorkspaceId = raced.result.value;
            if (notifiedWorkspaceId !== input.workspaceId) {
              continue;
            }
          }

          const newLogs = await loadNewLogs();
          if (newLogs.length > 0) {
            yield newLogs;
          }
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
