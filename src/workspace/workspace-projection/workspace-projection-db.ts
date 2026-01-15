import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { Logger } from '~/src/lib/logger';
import { AppNotification } from '~/src/shared/app-notification';
import type { Db, Tx } from '~/src/shared/db';
import type { UserId } from '~/src/users/user-id';
import * as schema from '../../db/schema';
import { WorkspaceEventDb } from '../workspace-event/workspace-event-db';
import { WorkspaceId } from '../workspace-id';
import { WorkspaceProjection } from './workspace-projection';

/**
 * Database operations for workspace projections
 */
export class WorkspaceProjectionDb {
  constructor(
    private readonly tx: Tx | Db,
    private readonly logger: Logger,
  ) {}

  /**
   * Loads the projection for a workspace by:
   * 1. Querying all events for the session
   * 2. Reducing them to compute the current state
   */
  async load(
    sessionId: WorkspaceId,
    startedByUserId: UserId,
  ): Promise<WorkspaceProjection> {
    const workspaceEventDb = new WorkspaceEventDb(this.tx, this.logger);
    const events = await workspaceEventDb.getBySessionId(sessionId);

    const initialState = WorkspaceProjection.init({
      sessionId,
      targetArtifactIds: [],
      startedAt: new Date(),
      startedByUserId: startedByUserId,
      lastUpdatedAt: new Date(),
    });

    const projection = WorkspaceProjection.reduce(events, initialState);

    return projection;
  }

  /**
   * Refreshes the projection for a workspace by:
   * 1. Querying all events for the session
   * 2. Reducing them to compute the current state
   * 3. Upserting the projection to the database
   */
  async refresh(
    sessionId: WorkspaceId,
    startedByUserId: UserId,
  ): Promise<WorkspaceProjection> {
    const projection = await this.load(sessionId, startedByUserId);

    // Upsert the projection for this workspace
    // Cast JSON string to jsonb to prevent double-encoding
    const projectionJson = JSON.stringify(projection);

    await this.tx
      .insert(schema.workspaceProjections)
      .values({
        workspace_id: projection.id,
        projection: sql`${projectionJson}::jsonb`,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.workspaceProjections.workspace_id,
        set: {
          projection: sql`${projectionJson}::jsonb`,
          updated_at: new Date(),
        },
      });

    const appNotification = new AppNotification(this.tx);
    await appNotification.notify({
      type: 'workspace_projection_update',
      payload: sessionId,
    });

    this.logger.info('Workspace projection updated', {
      sessionId,
      entryCount: projection.entries.length,
    });

    return projection;
  }

  /**
   * Lists workspace projections by startedByUserId with pagination
   */
  async listByStartedByUser(params: { userId: UserId; cursor?: string; limit: number }): Promise<{
    sessions: WorkspaceProjection[];
    hasMore: boolean;
    nextCursor: string | null;
  }> {
    const { userId, cursor, limit } = params;

    const conditions = [
      sql`COALESCE(
        ${schema.workspaceProjections.projection}->>'startedByUserId',
        (${schema.workspaceProjections.projection}#>>'{}')::jsonb->>'startedByUserId'
      ) = ${userId}`,
    ];

    if (cursor) {
      conditions.push(lt(schema.workspaceProjections.updated_at, new Date(cursor)));
    }

    const rows = await this.tx
      .select()
      .from(schema.workspaceProjections)
      .where(and(...conditions))
      .orderBy(desc(schema.workspaceProjections.updated_at))
      .limit(limit + 1);

    const sessions = rows.slice(0, limit).flatMap((row) => {
      const parsed = WorkspaceProjection.schema.safeParse(row.projection);
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
   * Fetch the owner of a workspace
   */
  async getOwner(sessionId: WorkspaceId): Promise<UserId | null> {
    const projection = await this.tx
      .select()
      .from(schema.workspaceProjections)
      .where(eq(schema.workspaceProjections.workspace_id, sessionId))
      .limit(1);

    const firstProjection = projection[0];
    if (!firstProjection) {
      return null;
    }

    const parsed = WorkspaceProjection.schema.parse(firstProjection.projection);
    return parsed.startedByUserId;
  }
}

export function createWorkspaceProjectionDb(params: {
  tx: Tx | Db;
  logger: Logger;
}): WorkspaceProjectionDb {
  return new WorkspaceProjectionDb(params.tx, params.logger);
}
