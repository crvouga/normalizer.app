import { artifactRouter } from '~/src/artifacts/artifact-router';
import { router } from './lib/trpc-server';

export const appRouter = router({
  artifact: artifactRouter,
});

export type AppRouter = typeof appRouter;
