import { z } from 'zod';
import { NormalizationSessionEventId } from './normalization-session-event-id';
import { NormalizationSessionId } from './normalization-session-id';
import { NormalizationSessionEvent } from './normalization-session-event';

/**
 * Zod schema for the NormalizationSessionEventEntity, matching the database schema.
 */
const schema = z.object({
  id: NormalizationSessionEventId.schema,
  normalization_session_id: NormalizationSessionId.schema,
  event: NormalizationSessionEvent.schema,
  created_at: z.coerce.date(),
});

export type NormalizationSessionEventEntity = z.infer<typeof schema>;

export const NormalizationSessionEventEntity = {
  schema,
};
