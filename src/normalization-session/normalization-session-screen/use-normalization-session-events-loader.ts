import { trpcClient } from '../../trpc-client';
import { useEntityStore } from '../../store/entity-store';
import type { NormalizationSessionId } from '../normalization-session-id';
import type { RemoteResult } from '../../lib/result';
import { useLoader } from '../../lib/use-loader';
import { PermissionEntityId } from '../../permissions/permission-entity-id';
import type { PermissionEntity } from '../../permissions/permission-entity';

/**
 * Hook for loading normalization session events from the server and storing them in the entity store.
 *
 * @param id - The normalization session ID to load events for
 * @returns The current remote result state (RemoteResult<void, Error>)
 */
export function useNormalizationSessionEventsLoader(
  id: NormalizationSessionId,
): RemoteResult<void, Error> {
  const entityStore = useEntityStore();

  const { state } = useLoader({
    loadData: async () => {
      // Fetch events and permissions from the server
      const response = await trpcClient.normalizationSession.events.getBySessionId.mutate({
        sessionId: id,
      });

      // Convert string dates to Date objects and store events in the entity store
      const eventsWithDates = response.events.map((event) => ({
        ...event,
        created_at: new Date(event.created_at),
        event: {
          ...event.event,
          startedAt: new Date(event.event.startedAt),
        },
      }));
      entityStore.addManyEntities('normalizationSessionEvents', eventsWithDates);

      // Store permissions in entity store
      const permissionEntities: PermissionEntity[] = [
        {
          id: PermissionEntityId.create('normalization-session', 'view', id),
          resource: 'normalization-session',
          action: 'view',
          resourceId: id,
          granted: response.permissions.canView,
        },
        {
          id: PermissionEntityId.create('normalization-session', 'edit', id),
          resource: 'normalization-session',
          action: 'edit',
          resourceId: id,
          granted: response.permissions.canEdit,
        },
        {
          id: PermissionEntityId.create('normalization-session', 'delete', id),
          resource: 'normalization-session',
          action: 'delete',
          resourceId: id,
          granted: response.permissions.canDelete,
        },
      ];

      entityStore.addManyEntities('permissions', permissionEntities);
    },
    deps: [id],
  });

  return state;
}
