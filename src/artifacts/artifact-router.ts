import { eq } from 'drizzle-orm';
import { z } from 'zod';
import * as schema from '../db/schema';
import { procedure, router } from '../lib/trpc-server';
import { Artifact } from './artifact';
import { artifactUploadRouter } from './artifact-upload/artifact-upload-router';

export const artifactRouter = router({
  upload: artifactUploadRouter,
  get: procedure
    .input(
      z.object({
        key: z.string(),
      }),
    )
    .output(Artifact.schema.nullable())
    .query(async ({ input, ctx }) => {
      const artifact = await ctx.db
        .select()
        .from(schema.artifacts)
        .where(eq(schema.artifacts.id, input.key))
        .limit(1)
        .then((rows) => rows[0]);

      if (!artifact) {
        return null;
      }

      // Validate and transform to Artifact type
      return Artifact.schema.parse(artifact);
    }),

  // List files for user
  list: procedure.output(z.array(Artifact.schema)).query(async ({ ctx }): Promise<Artifact[]> => {
    // You may want to filter by user or other logic in a real app
    const files = await ctx.db.select().from(schema.artifacts).orderBy(schema.artifacts.created_at);

    // Validate and transform to Artifact type array
    return z.array(Artifact.schema).parse(files);
  }),
});
