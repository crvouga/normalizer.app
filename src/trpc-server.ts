import { fileRouter } from '~/src/files/file-router';
import { router } from './lib/trpc-server';

export const appRouter = router({
  file: fileRouter,
});

export type AppRouter = typeof appRouter;
