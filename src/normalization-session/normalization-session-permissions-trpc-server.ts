import { z } from 'zod';
import { procedure, router } from '../lib/trpc-server';
import { NormalizationSessionId } from './normalization-session-id';
import {
  canViewNormalizationSession,
  viewNormalizationSessionPolicy,
  getNormalizationSessionOwner,
} from './normalization-session-permissions';
import { isGranted } from '../permissions/permission';

export const normalizationSessionPermissionsRouter = router({
  /**
   * Check if the current user can view a normalization session
   */
  canView: procedure
    .input(
      z.object({
        sessionId: NormalizationSessionId.schema,
      }),
    )
    .output(
      z.object({
        canView: z.boolean(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const permission = canViewNormalizationSession(input.sessionId);
      const resourceOwnerId = await getNormalizationSessionOwner(ctx.db, input.sessionId);

      if (!resourceOwnerId) {
        return {
          canView: false,
          reason: 'Session not found',
        };
      }

      const result = await ctx.checkPermission(permission, viewNormalizationSessionPolicy, {
        resourceOwnerId,
      });

      return {
        canView: isGranted(result),
        reason: isGranted(result) ? undefined : result.reason,
      };
    }),
});
