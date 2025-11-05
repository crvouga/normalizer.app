import { fileUploadRouter } from '~/src/files/file-trpc-router';
import { router } from './lib/trpc-server';

export const appRouter = router({
  fileUpload: fileUploadRouter,
});

export type AppRouter = typeof appRouter;
