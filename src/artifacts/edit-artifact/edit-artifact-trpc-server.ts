import { z } from 'zod';
import { procedure, router } from '../../shared/trpc-server';
import { ArtifactDb } from '../artifact-db';
import { ArtifactId } from '../artifact-id';

export const editArtifactRouter = router({
  update: procedure
    .input(
      z.object({
        artifactId: ArtifactId.schema,
        name: z.string().optional(),
        filename: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { artifactId, name, filename } = input;

      // Update and fetch the artifact in a transaction
      const updatedArtifact = await ctx.db.transaction(async (tx) => {
        const artifactDb = new ArtifactDb(tx, ctx.logger);
        return await artifactDb.update(artifactId, {
          name: name ?? null,
          filename: filename ?? null,
        });
      });

      return updatedArtifact;
    }),
});
