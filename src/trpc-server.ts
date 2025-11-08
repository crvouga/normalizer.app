import { artifactUploadRouter } from '~/src/artifacts/artifact-upload/artifact-upload-router';
import { artifactRouter } from './artifacts/artifact-router';
import { router } from './lib/trpc-server';

export const appRouter = router({
  artifact: artifactRouter,
  artifactUpload: artifactUploadRouter,
});

export type AppRouter = typeof appRouter;
