import { artifactRouter } from './artifacts/artifact-trpc-server';
import { authRouter } from './auth/google-auth-trpc-server';
import { router } from './lib/trpc-server';
import { normalizationSessionRouter } from './normalization-session/normalization-session-trpc-server';
import { usersRouter } from './users/users-trpc-server';

export const appRouter = router({
  artifact: artifactRouter,
  users: usersRouter,
  auth: authRouter,
  normalizationSession: normalizationSessionRouter,
});

export type AppRouter = typeof appRouter;
