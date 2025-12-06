import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { Logger } from '~/src/lib/logger';
import { AppNotification } from '~/src/shared/app-notification';
import type { Db, Tx } from '~/src/shared/db';
import type { UserId } from '~/src/users/user-id';
import * as schema from '../../db/schema';
import { NormalizationSessionEventDb } from '../normalization-session-event/normalization-session-event-db';
import { NormalizationSessionId } from '../normalization-session-id';
import { NormalizationSessionProjection } from './normalization-session-projection';

/**
 * Database operations for normalization session projections
 */
export class NormalizationSessionProjectionDb {
  constructor(
    private readonly tx: Tx | Db,
    private readonly logger: Logger,
  ) {}

  /**
   * Loads the projection for a normalization session by:
   * 1. Querying all events for the session
   * 2. Reducing them to compute the current state
   */
  async load(
    sessionId: NormalizationSessionId,
    startedByUserId: UserId,
  ): Promise<NormalizationSessionProjection> {
    const normalizationSessionEventDb = new NormalizationSessionEventDb(this.tx, this.logger);
    const events = await normalizationSessionEventDb.getBySessionId(sessionId);

    const initialState = NormalizationSessionProjection.init({
      sessionId,
      targetArtifactIds: [],
      startedAt: new Date(),
      startedByUserId: startedByUserId,
      lastUpdatedAt: new Date(),
    });

    const projection = NormalizationSessionProjection.reduce(events, initialState);

    return projection;
  }

  /**
   * Refreshes the projection for a normalization session by:
   * 1. Querying all events for the session
   * 2. Reducing them to compute the current state
   * 3. Upserting the projection to the database
   */
  async refresh(
    sessionId: NormalizationSessionId,
    startedByUserId: UserId,
  ): Promise<NormalizationSessionProjection> {
    const projection = await this.load(sessionId, startedByUserId);

    // Upsert the projection for this normalization session
    // Cast JSON string to jsonb to prevent double-encoding
    const projectionJson = JSON.stringify(projection);

    await this.tx
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

    const appNotification = new AppNotification(this.tx);
    await appNotification.notify({
      type: 'normalization_session_projection_update',
      payload: sessionId,
    });

    this.logger.info('Normalization session projection updated', {
      sessionId,
      entryCount: projection.entries.length,
    });

    return projection;
  }

  /**
   * Lists normalization session projections by startedByUserId with pagination
   */
  async listByStartedByUser(params: { userId: UserId; cursor?: string; limit: number }): Promise<{
    sessions: NormalizationSessionProjection[];
    hasMore: boolean;
    nextCursor: string | null;
  }> {
    const { userId, cursor, limit } = params;

    const conditions = [
      sql`COALESCE(
        ${schema.normalizationSessionProjections.projection}->>'startedByUserId',
        (${schema.normalizationSessionProjections.projection}#>>'{}')::jsonb->>'startedByUserId'
      ) = ${userId}`,
    ];

    if (cursor) {
      conditions.push(lt(schema.normalizationSessionProjections.updated_at, new Date(cursor)));
    }

    const rows = await this.tx
      .select()
      .from(schema.normalizationSessionProjections)
      .where(and(...conditions))
      .orderBy(desc(schema.normalizationSessionProjections.updated_at))
      .limit(limit + 1);

    const sessions = rows.slice(0, limit).flatMap((row) => {
      const parsed = NormalizationSessionProjection.schema.safeParse(row.projection);
      return parsed.success ? [parsed.data] : [];
    });

    const hasMore = rows.length > limit;
    const lastRow = rows[limit - 1];
    const nextCursor = hasMore && lastRow?.updated_at ? lastRow.updated_at.toISOString() : null;

    return {
      sessions,
      hasMore,
      nextCursor,
    };
  }

  /**
   * Fetch the owner of a normalization session
   */
  async getOwner(sessionId: NormalizationSessionId): Promise<UserId | null> {
    const projection = await this.tx
      .select()
      .from(schema.normalizationSessionProjections)
      .where(eq(schema.normalizationSessionProjections.normalization_session_id, sessionId))
      .limit(1);

    const firstProjection = projection[0];
    if (!firstProjection) {
      return null;
    }

    const parsed = NormalizationSessionProjection.schema.parse(firstProjection.projection);
    return parsed.startedByUserId;
  }
}
