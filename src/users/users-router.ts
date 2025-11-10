import { procedure, router } from '../lib/trpc-server';
import { users, userSessions } from '../db/schema';
import { eq } from 'drizzle-orm';
import { findActiveAuthenticatedSession, findCurrentUserSession } from './user-session-queries';

export const usersRouter = router({
  /**
   * Get or create current user
   * This mutation ensures a user and user_session record exists for the current session
   */
  currentUser: procedure.mutation(async ({ ctx }) => {
    const session = await findCurrentUserSession(ctx.db, ctx.sessionId);

    if (!session?.user) {
      throw new Error('User not found');
    }

    const user = session.user;

    // Don't expose session_id to client
    return {
      id: user.id,
      type: user.type,
      name: user.name,
      email: user.email,
      profile_picture: user.profile_picture,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }),

  /**
   * Logout - end the current authenticated user session
   * This is provider-agnostic and works for any authentication method
   */
  logout: procedure.mutation(async ({ ctx }) => {
    // Find the active authenticated session for this session_id
    const activeSession = await findActiveAuthenticatedSession(ctx.db, ctx.sessionId);

    if (!activeSession) {
      throw new Error('No active session found');
    }

    if (activeSession.user.type !== 'authenticated') {
      throw new Error('Cannot logout - user is not authenticated');
    }

    // End the authenticated session by setting ended_at
    await ctx.db
      .update(userSessions)
      .set({ ended_at: new Date() })
      .where(eq(userSessions.id, activeSession.id));

    ctx.logger.info('User logged out', {
      session_id: ctx.sessionId,
      user_id: activeSession.user_id,
    });

    return { success: true };
  }),
});
