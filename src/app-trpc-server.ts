import { artifactRouter } from './artifacts/artifact-trpc-server';
import { authRouter } from './auth/google-auth/google-auth-trpc-server';
import { router } from './shared/trpc-server';
import { workspaceRouter } from './workspace/workspace-trpc-server';
import { usersRouter } from './users/users-trpc-server';

export const appRouter = router({
  artifact: artifactRouter,
  users: usersRouter,
  auth: authRouter,
  workspace: workspaceRouter,
});

export type AppRouter = typeof appRouter;
