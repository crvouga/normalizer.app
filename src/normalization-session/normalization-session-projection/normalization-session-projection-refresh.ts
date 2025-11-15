import { sql } from 'drizzle-orm';
import type { Logger } from '~/src/lib/logger';
import type { Db, Tx } from '~/src/sql';
import type { UserId } from '~/src/users/user-id';
import * as schema from '../../db/schema';
import { NormalizationSessionId } from '../normalization-session-id';
import { NormalizationSessionProjection } from './normalization-session-projection';
import { loadNormalizationSessionProjection } from './normalization-session-projection-load';

/**
 * Refreshes the projection for a normalization session by:
 * 1. Querying all events for the session
 * 2. Reducing them to compute the current state
 * 3. Upserting the projection to the database
 */
export async function refreshNormalizationSessionProjection(params: {
  tx: Tx | Db;
  sessionId: NormalizationSessionId;
  startedByUserId: UserId;
  logger: Logger;
}): Promise<NormalizationSessionProjection> {
  const { tx, sessionId, logger } = params;

  const projection = await loadNormalizationSessionProjection(params);

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
    entryCount: projection.entries.length,
  });

  return projection;
}
