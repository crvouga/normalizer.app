import type { Artifact } from '../artifacts/artifact';
import type { ArtifactId } from '../artifacts/artifact-id';
import type { EntitySlice, IndexDefinition } from '../lib/entity-store-library';
import type { WorkspaceEventEntity } from '../workspace/workspace-event/workspace-event-entity';
import type { WorkspaceEventId } from '../workspace/workspace-event/workspace-event-id';
import type { WorkspaceId } from '../workspace/workspace-id';
import type { WorkspaceProjection } from '../workspace/workspace-projection/workspace-projection';
import type { ResourceOwnershipEntity } from '../permissions/resource-ownership-entity';
import type { ResourceOwnershipEntityId } from '../permissions/resource-ownership-entity-id';
import type { User } from '../users/user';
import type { UserId } from '../users/user-id';

// Define entity types
export type EntityStore = {
  entities: {
    artifacts: EntitySlice<ArtifactId, Artifact>;
    users: EntitySlice<UserId, User>;
    workspaceEvents: EntitySlice<WorkspaceEventId, WorkspaceEventEntity>;
    workspaceProjections: EntitySlice<WorkspaceId, WorkspaceProjection>;
    resourceOwnerships: EntitySlice<ResourceOwnershipEntityId, ResourceOwnershipEntity>;
  };
  indexes: {
    indexWorkspaceEventsBySessionId: Record<WorkspaceId, WorkspaceEventId[]>;
    indexWorkspaceProjectionsByUserId: Record<UserId, WorkspaceId[]>;
    indexResourceOwnershipsByResourceId: Record<string, ResourceOwnershipEntityId[]>;
  };
};

// Initial state
export const initialEntityStore: EntityStore = {
  entities: {
    artifacts: {
      byId: {},
      allIds: [],
    },
    users: {
      byId: {},
      allIds: [],
    },
    workspaceEvents: {
      byId: {},
      allIds: [],
    },
    workspaceProjections: {
      byId: {},
      allIds: [],
    },
    resourceOwnerships: {
      byId: {},
      allIds: [],
    },
  },
  indexes: {
    indexWorkspaceEventsBySessionId: {},
    indexWorkspaceProjectionsByUserId: {},
    indexResourceOwnershipsByResourceId: {},
  },
};

// Type to enforce that index definitions match index names in EntityStore
type IndexDefinitionsConfig = {
  [K in keyof EntityStore['indexes']]: {
    entityType: keyof EntityStore['entities'];
    definition: IndexDefinition;
  };
};

// Define indexes declaratively with type safety
export const indexDefinitions: IndexDefinitionsConfig = {
  indexWorkspaceEventsBySessionId: {
    entityType: 'workspaceEvents',
    definition: {
      getIndexKey(entity) {
        if (
          entity &&
          typeof entity === 'object' &&
          'workspace_id' in entity &&
          typeof entity.workspace_id === 'string'
        ) {
          return entity.workspace_id;
        }
        return undefined;
      },
      getEntityId(entity) {
        if (
          entity &&
          typeof entity === 'object' &&
          'id' in entity &&
          typeof entity.id === 'string'
        ) {
          return entity.id;
        }
        return '';
      },
    },
  },
  indexWorkspaceProjectionsByUserId: {
    entityType: 'workspaceProjections',
    definition: {
      getIndexKey(entity) {
        if (
          entity &&
          typeof entity === 'object' &&
          'startedByUserId' in entity &&
          typeof entity.startedByUserId === 'string'
        ) {
          return entity.startedByUserId;
        }
        return undefined;
      },
      getEntityId(entity) {
        if (
          entity &&
          typeof entity === 'object' &&
          'id' in entity &&
          typeof entity.id === 'string'
        ) {
          return entity.id;
        }
        return '';
      },
    },
  },
  indexResourceOwnershipsByResourceId: {
    entityType: 'resourceOwnerships',
    definition: {
      getIndexKey(entity) {
        if (
          entity &&
          typeof entity === 'object' &&
          'resourceId' in entity &&
          typeof entity.resourceId === 'string'
        ) {
          return entity.resourceId;
        }
        return undefined;
      },
      getEntityId(entity) {
        if (
          entity &&
          typeof entity === 'object' &&
          'id' in entity &&
          typeof entity.id === 'string'
        ) {
          return entity.id;
        }
        return '';
      },
    },
  },
} satisfies IndexDefinitionsConfig;

// Type helpers for better DX
export type EntityType = keyof EntityStore['entities'];
