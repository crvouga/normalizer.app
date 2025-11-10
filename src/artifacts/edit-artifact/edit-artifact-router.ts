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
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { artifactId, name } = input;

      // Update the artifact in the database
      await ctx.db
        .update(schema.artifacts)
        .set({
          name: name ?? undefined,
          updated_at: new Date(),
        })
        .where(eq(schema.artifacts.id, artifactId));

      // Fetch the updated artifact
      const updatedArtifact = await ctx.db
        .select()
        .from(schema.artifacts)
        .where(eq(schema.artifacts.id, artifactId))
        .limit(1)
        .then((rows) => rows[0]);

      if (!updatedArtifact) {
        throw new Error('Artifact not found after update');
      }

      // Validate and return
      return Artifact.schema.parse(updatedArtifact);
    }),
});
