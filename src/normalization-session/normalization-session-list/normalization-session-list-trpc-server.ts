import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { refreshArtifactUrls } from '~/src/artifacts/artifact-urls-refresh';
import { Artifact } from '../../artifacts/artifact';
import * as schema from '../../db/schema';
import { procedure, router } from '../../lib/trpc-server';
import { UserId } from '../../users/user-id';
import { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';

export const normalizationSessionListRouter = router({
  /**
   * List normalization sessions by user with cursor-based pagination
   */
  listByStartedByUser: procedure
    .input(
      z.object({
        userId: UserId.schema,
        cursor: z.string().optional(), // ISO timestamp string
        limit: z.number().min(1).max(100).default(20),
      }),
    )
    .output(
      z.object({
        sessions: z.array(NormalizationSessionProjection.schema),
        artifacts: z.array(Artifact.schema),
        nextCursor: z.string().nullable(),
        hasMore: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      ctx.logger.info('Normalization session list by user', {
        userId: input.userId,
        cursor: input.cursor,
        limit: input.limit,
      });

      // Build query conditions
      // Handle both object and string JSONB formats for backwards compatibility
      const conditions = [
        sql`COALESCE(
          ${schema.normalizationSessionProjections.projection}->>'startedByUserId',
          (${schema.normalizationSessionProjections.projection}#>>'{}')::jsonb->>'startedByUserId'
        ) = ${input.userId}`,
      ];

      // Add cursor condition if provided
      if (input.cursor) {
        conditions.push(
          lt(schema.normalizationSessionProjections.updated_at, new Date(input.cursor)),
        );
      }

      const query = ctx.db
        .select()
        .from(schema.normalizationSessionProjections)
        .where(and(...conditions))
        .orderBy(desc(schema.normalizationSessionProjections.updated_at))
        .limit(input.limit + 1); // Fetch one extra to determine if there's more

      // Log the compiled SQL query with parameters
      const compiled = query.toSQL();
      // Assemble the raw SQL with parameters inline for copy-paste
      let rawSql = compiled.sql;
      let pos = 0;
      for (const param of compiled.params) {
        pos++;
        // Simple heuristic: quote string params, print as-is for non-strings
        const formatted =
          typeof param === 'string'
            ? `'${param.replace(/'/g, "''")}'`
            : param instanceof Date
              ? `'${param.toISOString()}'`
              : param;
        rawSql = rawSql.replace(`$${pos}`, String(formatted));
      }
      ctx.logger.debug('Normalization session list compiled SQL', {
        sql: compiled.sql,
        params: compiled.params,
        raw: rawSql,
      });

      // Query projections with pagination
      const rows = await query;

      // Parse projections from JSONB
      const projections = rows
        .slice(0, input.limit)
        .map((row) => NormalizationSessionProjection.schema.parse(row.projection));

      // Determine if there are more results
      const hasMore = rows.length > input.limit;

      // Get next cursor from the last item's updated_at
      const nextCursor =
        hasMore && rows[input.limit - 1]?.updated_at
          ? rows[input.limit - 1].updated_at.toISOString()
          : null;

      ctx.logger.info('Normalization session list retrieved', {
        userId: input.userId,
        count: projections.length,
        hasMore,
      });

      // Collect all unique artifact IDs from all projections
      const artifactIds = Array.from(
        new Set(projections.flatMap((projection) => projection.targetArtifactIds)),
      );

      ctx.logger.debug('Fetching artifacts for projections', {
        artifactIds,
        count: artifactIds.length,
      });

      // Fetch all artifacts if there are any IDs
      let artifacts: Artifact[] = [];
      if (artifactIds.length > 0) {
        const artifactRows = await ctx.db
          .select()
          .from(schema.artifacts)
          .where(and(inArray(schema.artifacts.id, artifactIds), isNull(schema.artifacts.deleted)));

        // Validate and transform artifacts
        artifacts = artifactRows.map((row) => Artifact.schema.parse(row));

        // Refresh artifact URLs and persist to database if needed
        artifacts = await refreshArtifactUrls({ ...ctx, artifacts });

        ctx.logger.info('Artifacts fetched for sessions', {
          count: artifacts.length,
        });
      }

      return {
        sessions: projections,
        artifacts,
        nextCursor,
        hasMore,
      };
    }),
});
