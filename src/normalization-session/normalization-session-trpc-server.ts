import { router } from '../shared/trpc-server';
import { normalizationSessionEventRouter } from './normalization-session-event/normalization-session-event-trpc-server';
import { normalizationSessionListRouter } from './normalization-session-list/normalization-session-list-trpc-server';
import { normalizationSessionProjectionRouter } from './normalization-session-projection/normalization-session-projection-trpc-server';

export const normalizationSessionRouter = router({
  events: normalizationSessionEventRouter,
  list: normalizationSessionListRouter,
  projection: normalizationSessionProjectionRouter,
});
