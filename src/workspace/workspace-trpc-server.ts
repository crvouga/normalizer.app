import { router } from '../shared/trpc-server';
import { workspaceEventRouter } from './workspace-event/workspace-event-trpc-server';
import { workspaceListRouter } from './workspace-list/workspace-list-trpc-server';
import { workspaceProjectionRouter } from './workspace-projection/workspace-projection-trpc-server';

export const workspaceRouter = router({
  events: workspaceEventRouter,
  list: workspaceListRouter,
  projection: workspaceProjectionRouter,
});
