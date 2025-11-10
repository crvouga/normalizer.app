import { z } from 'zod';
import { SessionId } from '../lib/session-id';
import { UserId } from './user-id';
import { UserSessionId } from './user-session-id';

const schema = z.object({
  id: UserSessionId.schema,
  session_id: SessionId.schema,
  user_id: UserId.schema,
  started_at: z.coerce.date(),
  ended_at: z.coerce.date().nullable().optional(),
});

export type UserSession = z.infer<typeof schema>;

export const UserSession = {
  schema,
};
