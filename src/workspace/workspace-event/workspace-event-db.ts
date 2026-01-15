import { eq } from 'drizzle-orm';
import type { Logger } from '~/src/lib/logger';
import type { Db, Tx } from '~/src/shared/db';
import * as schema from '../../db/schema';
import { WorkspaceEventEntity } from './workspace-event-entity';
import { WorkspaceEventId } from './workspace-event-id';
import { WorkspaceId } from '../workspace-id';
import { WorkspaceEventEntityPersisted } from './workspace-event-entity-persisted';

/**
 * Database operations for workspace events
 */
export class WorkspaceEventDb {
  constructor(
    private readonly tx: Tx | Db,
    private readonly logger: Logger,
  ) {}

  async getByWorkspaceId(workspaceId: WorkspaceId): Promise<WorkspaceEventEntity[]> {
    // Query all events for this session
    const events = await this.tx
      .select()
      .from(schema.workspaceEvents)
      .where(eq(schema.workspaceEvents.workspace_id, workspaceId))
      .orderBy(schema.workspaceEvents.created_at);

    // Validate events
    const validatedEvents: WorkspaceEventEntityPersisted[] = events.flatMap(
      (event: (typeof events)[number]) => {
        const parsedEvent = WorkspaceEventEntityPersisted.schema.safeParse(event);
        if (parsedEvent.success) {
          return [parsedEvent.data];
        }
        return [];
      },
    );

    return validatedEvents.map(WorkspaceEventEntityPersisted.migrate);
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
