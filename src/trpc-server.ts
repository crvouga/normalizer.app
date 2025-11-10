import { artifactRouter } from './artifacts/artifact-router';
import { usersRouter } from './users/users-router';
import { router } from './lib/trpc-server';

export const appRouter = router({
  artifact: artifactRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
