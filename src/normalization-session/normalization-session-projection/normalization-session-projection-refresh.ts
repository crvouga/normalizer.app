import { eq, sql, type ExtractTablesWithRelations } from 'drizzle-orm';
import type { BunSQLQueryResultHKT } from 'drizzle-orm/bun-sql';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import type { Logger } from '~/src/lib/logger';
import type { UserId } from '~/src/users/user-id';
import * as schema from '../../db/schema';
import { NormalizationSessionId } from '../normalization-session-id';
import { NormalizationSessionProjection } from './normalization-session-projection';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';

/**
 * Refreshes the projection for a normalization session by:
 * 1. Querying all events for the session
 * 2. Reducing them to compute the current state
 * 3. Upserting the projection to the database
 */
export async function refreshNormalizationSessionProjection(params: {
  tx: PgTransaction<BunSQLQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;
  sessionId: NormalizationSessionId;
  startedByUserId: UserId;
  logger: Logger;
}): Promise<NormalizationSessionProjection> {
  const { tx, sessionId, startedByUserId, logger } = params;

  // Query all events for this session
  const events = await tx
    .select()
    .from(schema.normalizationSessionEvents)
    .where(eq(schema.normalizationSessionEvents.normalization_session_id, sessionId))
    .orderBy(schema.normalizationSessionEvents.created_at);

  // Validate events
  const validatedEvents = z.array(NormalizationSessionEventEntity.schema).parse(events);

  // Compute projection by reducing all events
  const initialState = NormalizationSessionProjection.init({
    sessionId,
    targetArtifactIds: [],
    startedAt: new Date(),
    startedByUserId: startedByUserId,
    lastUpdatedAt: new Date(),
  });

  const projection = NormalizationSessionProjection.reduce(validatedEvents, initialState);

  // Upsert the projection for this normalization session
  // Cast JSON string to jsonb to prevent double-encoding
  const projectionJson = JSON.stringify(projection);

  await tx
    .insert(schema.normalizationSessionProjections)
    .values({
      normalization_session_id: projection.id,
      projection: sql`${projectionJson}::jsonb`,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.normalizationSessionProjections.normalization_session_id,
      set: {
        projection: sql`${projectionJson}::jsonb`,
        updated_at: new Date(),
      },
    });

  logger.info('Normalization session projection updated', {
    sessionId,
    eventCount: events.length,
  });

  return projection;
}
