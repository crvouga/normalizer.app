import { eq } from 'drizzle-orm';
import type { Logger } from '~/src/lib/logger';
import type { Db, Tx } from '~/src/sql';
import type { UserId } from '~/src/users/user-id';
import * as schema from '../../db/schema';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import { NormalizationSessionId } from '../normalization-session-id';
import { NormalizationSessionProjection } from './normalization-session-projection';

/**
 * Loads the projection for a normalization session by:
 * 1. Querying all events for the session
 * 2. Reducing them to compute the current state
 */
export async function loadNormalizationSessionProjection(params: {
  tx: Tx | Db;
  sessionId: NormalizationSessionId;
  startedByUserId: UserId;
  logger: Logger;
}): Promise<NormalizationSessionProjection> {
  const { tx, sessionId, startedByUserId } = params;

  // Query all events for this session
  const events = await tx
    .select()
    .from(schema.normalizationSessionEvents)
    .where(eq(schema.normalizationSessionEvents.normalization_session_id, sessionId))
    .orderBy(schema.normalizationSessionEvents.created_at);

  // Validate events
  const validatedEvents: NormalizationSessionEventEntity[] = events.flatMap((event) => {
    const parsedEvent = NormalizationSessionEventEntity.schema.safeParse(event);
    if (parsedEvent.success) {
      return [parsedEvent.data];
    }
    return [];
  });

  // Compute projection by reducing all events
  const initialState = NormalizationSessionProjection.init({
    sessionId,
    targetArtifactIds: [],
    startedAt: new Date(),
    startedByUserId: startedByUserId,
    lastUpdatedAt: new Date(),
  });

  const projection = NormalizationSessionProjection.reduce(validatedEvents, initialState);

  return projection;
}
