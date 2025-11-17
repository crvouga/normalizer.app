import { eq } from 'drizzle-orm';
import type { Logger } from '~/src/lib/logger';
import type { Db, Tx } from '~/src/shared/sql';
import * as schema from '../../db/schema';
import { NormalizationSessionEventEntity } from './normalization-session-event-entity';
import { NormalizationSessionEventId } from './normalization-session-event-id';
import { NormalizationSessionId } from '../normalization-session-id';

/**
 * Database operations for normalization session events
 */
export class NormalizationSessionEventDb {
  constructor(
    private readonly tx: Tx | Db,
    private readonly logger: Logger,
  ) {}

  async getBySessionId(
    sessionId: NormalizationSessionId,
  ): Promise<NormalizationSessionEventEntity[]> {
    // Query all events for this session
    const events = await this.tx
      .select()
      .from(schema.normalizationSessionEvents)
      .where(eq(schema.normalizationSessionEvents.normalization_session_id, sessionId))
      .orderBy(schema.normalizationSessionEvents.created_at);

    // Validate events
    const validatedEvents: NormalizationSessionEventEntity[] = events.flatMap(
      (event: (typeof events)[number]) => {
        const parsedEvent = NormalizationSessionEventEntity.schema.safeParse(event);
        if (parsedEvent.success) {
          return [parsedEvent.data];
        }
        return [];
      },
    );

    return validatedEvents;
  }

  /**
   * Append a new event to a normalization session
   * Generates a new event ID if not provided
   */
  async append(event: NormalizationSessionEventEntity): Promise<NormalizationSessionEventEntity> {
    const eventToInsert = {
      ...event,
      id: event.id ?? NormalizationSessionEventId.generate(),
      created_at: event.created_at ?? new Date(),
    };

    this.logger.debug('Appending normalization session event', {
      sessionId: event.normalization_session_id,
      eventId: eventToInsert.id,
      eventType: event.event.type,
    });

    await this.tx.insert(schema.normalizationSessionEvents).values(eventToInsert);

    this.logger.info('Normalization session event appended', {
      sessionId: event.normalization_session_id,
      eventId: eventToInsert.id,
      eventType: event.event.type,
    });

    return eventToInsert;
  }
}
