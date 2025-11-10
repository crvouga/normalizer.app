import { artifactRouter } from './artifacts/artifact-router';
import { usersRouter } from './users/users-router';
import { authRouter } from './auth/google-auth-router';
import { router } from './lib/trpc-server';

export const appRouter = router({
  artifact: artifactRouter,
  users: usersRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
