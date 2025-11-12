import { router } from '../lib/trpc-server';
import { normalizationSessionEventRouter } from './normalization-session-event/normalization-session-event-trpc-server';
import { normalizationSessionListRouter } from './normalization-session-list/normalization-session-list-trpc-server';
import { normalizationSessionPermissionsRouter } from './normalization-session-permissions-trpc-server';

export const normalizationSessionRouter = router({
  events: normalizationSessionEventRouter,
  list: normalizationSessionListRouter,
  permissions: normalizationSessionPermissionsRouter,
});
