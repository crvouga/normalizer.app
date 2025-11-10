import { procedure, router } from '../lib/trpc-server';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export const usersRouter = router({
  /**
   * Get or create current user
   * This mutation ensures a user and user_session record exists for the current session
   */
  currentUser: procedure.mutation(async ({ ctx }) => {
    // User is already created in context, just fetch and return
    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.userId),
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Don't expose session_id to client
    return {
      id: user.id,
      type: user.type,
      name: user.name,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }),
});
