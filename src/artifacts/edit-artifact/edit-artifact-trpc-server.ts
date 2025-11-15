import { eq } from 'drizzle-orm';
import { z } from 'zod';
import * as schema from '../../db/schema';
import { procedure, router } from '../../lib/trpc-server';
import { ArtifactId } from '../artifact-id';
import { Artifact } from '../artifact';

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
        await tx
          .update(schema.artifacts)
          .set({
            name: name ?? undefined,
            filename: filename ?? undefined,
            updated_at: new Date(),
          })
          .where(eq(schema.artifacts.id, artifactId));

        const artifact = await tx
          .select()
          .from(schema.artifacts)
          .where(eq(schema.artifacts.id, artifactId))
          .limit(1)
          .then((rows) => rows[0]);

        if (!artifact) {
          throw new Error('Artifact not found after update');
        }

        return artifact;
      });

      // Validate and return
      return Artifact.schema.parse(updatedArtifact);
    }),
});
