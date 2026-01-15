import { eq } from 'drizzle-orm';
import type { Logger } from '~/src/lib/logger';
import type { Db, Tx } from '~/src/shared/db';
import * as schema from '../../db/schema';
import { WorkspaceId } from '../workspace-id';
import { WorkspaceEventEntity } from './workspace-event-entity';
import { WorkspaceEventEntityPersisted } from './workspace-event-entity-persisted';
import { WorkspaceEventId } from './workspace-event-id';

/**
 * Database operations for workspace events
 */
export class WorkspaceEventDb {
  constructor(
    private readonly tx: Tx | Db,
    private readonly logger: Logger,
  ) {}

  async getByWorkspaceId(workspaceId: WorkspaceId): Promise<WorkspaceEventEntity[]> {
    const persistedEvents = await this.tx
      .select()
      .from(schema.workspaceEvents)
      .where(eq(schema.workspaceEvents.workspace_id, workspaceId))
      .orderBy(schema.workspaceEvents.created_at);

    const events = persistedEvents.flatMap((event): WorkspaceEventEntity[] => {
      const parsedEvent = WorkspaceEventEntityPersisted.schema.safeParse(event);

      if (!parsedEvent.success) {
        this.logger.error('Failed to parse workspace event', {
          event,
          error: parsedEvent.error,
        });
        return [];
      }

      const migratedEvent = WorkspaceEventEntityPersisted.migrate(parsedEvent.data);

      return [migratedEvent];
    });

    return events;
  }

  /**
   * Append a new event to a workspace
   * Generates a new event ID if not provided
   */
  async append(event: WorkspaceEventEntity): Promise<WorkspaceEventEntity> {
    const eventToInsert = {
      ...event,
      id: event.id ?? WorkspaceEventId.generate(),
      created_at: event.created_at ?? new Date(),
    };

    this.logger.debug('Appending workspace event', {
      sessionId: event.workspace_id,
      eventId: eventToInsert.id,
      eventType: event.event.type,
    });

    await this.tx.insert(schema.workspaceEvents).values(eventToInsert);

    this.logger.info('Workspace event appended', {
      sessionId: event.workspace_id,
      eventId: eventToInsert.id,
      eventType: event.event.type,
    });

    return eventToInsert;
  }
}

export function createWorkspaceEventDb(params: { tx: Tx | Db; logger: Logger }): WorkspaceEventDb {
  return new WorkspaceEventDb(params.tx, params.logger);
}
