import { artifactRouter } from './artifacts/artifact-trpc-server';
import { usersRouter } from './users/users-trpc-server';
import { authRouter } from './auth/google-auth-trpc-server';
import { router } from './lib/trpc-server';

export const appRouter = router({
  artifact: artifactRouter,
  users: usersRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
