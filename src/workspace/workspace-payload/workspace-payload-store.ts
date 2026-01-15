import { useCallback } from 'react';
import { useEntityStore } from '~/src/store/entity-store';
import { WorkspacePayload } from './workspace-payload';

export function useAddWorkspacePayloadToStore() {
  const entityStore = useEntityStore();
  return useCallback(
    (payload: WorkspacePayload) => {
      const parsed = WorkspacePayload.schema.safeParse(payload);
      if (!parsed.success) {
        console.error('Invalid projection payload', parsed.error);
        return;
      }
      const {
        workspaceEvents: events,
        workspaceProjections: projections,
        artifacts,
        resourceOwnership,
      } = parsed.data;

      if (events.length > 0) {
        entityStore.addManyEntities('workspaceEvents', events);
      }
      if (projections.length > 0) {
        entityStore.addManyEntities('workspaceProjections', projections);
      }
      if (artifacts.length > 0) {
        entityStore.addManyEntities('artifacts', artifacts);
      }
      if (resourceOwnership.length > 0) {
        entityStore.addManyEntities('resourceOwnerships', resourceOwnership);
      }
    },
    [entityStore],
  );
}
