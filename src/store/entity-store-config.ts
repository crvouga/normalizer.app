import type { Artifact } from '../artifacts/artifact';
import type { ArtifactId } from '../artifacts/artifact-id';
import type { User } from '../users/user';
import type { UserId } from '../users/user-id';
import type { NormalizationSessionEventEntity } from '../normalization-session/normalization-session-event/normalization-session-event-entity';
import type { NormalizationSessionEventId } from '../normalization-session/normalization-session-event/normalization-session-event-id';
import type { NormalizationSessionId } from '../normalization-session/normalization-session-id';
import type { NormalizationSessionProjection } from '../normalization-session/normalization-session-projection/normalization-session-projection';
import type { EntitySlice, IndexDefinition } from '../lib/entity-store-library';
import type { ResourceOwnershipEntityId } from '../permissions/resource-ownership-entity-id';
import type { ResourceOwnershipEntity } from '../permissions/resource-ownership-entity';

// Define entity types
export type EntityStore = {
  entities: {
    artifacts: EntitySlice<ArtifactId, Artifact>;
    users: EntitySlice<UserId, User>;
    normalizationSessionEvents: EntitySlice<
      NormalizationSessionEventId,
      NormalizationSessionEventEntity
    >;
    normalizationSessionProjections: EntitySlice<
      NormalizationSessionId,
      NormalizationSessionProjection
    >;
    resourceOwnerships: EntitySlice<ResourceOwnershipEntityId, ResourceOwnershipEntity>;
  };
  indexes: {
    indexNormalizationSessionEventsBySessionId: Record<
      NormalizationSessionId,
      NormalizationSessionEventId[]
    >;
    indexNormalizationSessionProjectionsByUserId: Record<UserId, NormalizationSessionId[]>;
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
    normalizationSessionEvents: {
      byId: {},
      allIds: [],
    },
    normalizationSessionProjections: {
      byId: {},
      allIds: [],
    },
    resourceOwnerships: {
      byId: {},
      allIds: [],
    },
  },
  indexes: {
    indexNormalizationSessionEventsBySessionId: {},
    indexNormalizationSessionProjectionsByUserId: {},
    indexResourceOwnershipsByResourceId: {},
  },
};

// Type to enforce that index definitions match index names in EntityStore
type IndexDefinitionsConfig = {
  [K in keyof EntityStore['indexes']]: {
    entityType: keyof EntityStore['entities'];
    definition: IndexDefinition<any>;
  };
};

// Define indexes declaratively with type safety
export const indexDefinitions: IndexDefinitionsConfig = {
  indexNormalizationSessionEventsBySessionId: {
    entityType: 'normalizationSessionEvents',
    definition: {
      getIndexKey: (entity: unknown) => {
        if (
          entity &&
          typeof entity === 'object' &&
          'normalization_session_id' in entity &&
          typeof entity.normalization_session_id === 'string'
        ) {
          return entity.normalization_session_id;
        }
        return undefined;
      },
      getEntityId: (entity: unknown) => {
        if (entity && typeof entity === 'object' && 'id' in entity) {
          return entity.id as string;
        }
        return '';
      },
    } as IndexDefinition<NormalizationSessionEventEntity>,
  },
  indexNormalizationSessionProjectionsByUserId: {
    entityType: 'normalizationSessionProjections',
    definition: {
      getIndexKey: (entity: unknown) => {
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
      getEntityId: (entity: unknown) => {
        if (entity && typeof entity === 'object' && 'id' in entity) {
          return entity.id as string;
        }
        return '';
      },
    } as IndexDefinition<NormalizationSessionProjection>,
  },
  indexResourceOwnershipsByResourceId: {
    entityType: 'resourceOwnerships',
    definition: {
      getIndexKey: (entity: unknown) => {
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
      getEntityId: (entity: unknown) => {
        if (entity && typeof entity === 'object' && 'id' in entity) {
          return entity.id as string;
        }
        return '';
      },
    } as IndexDefinition<ResourceOwnershipEntity>,
  },
} satisfies IndexDefinitionsConfig;

// Type helpers for better DX
export type EntityType = keyof EntityStore['entities'];

// Entity accessors
export type ArtifactEntity = Artifact;
export type UserEntity = User;
export type NormalizationSessionEvent = NormalizationSessionEventEntity;
export type NormalizationSessionProjectionEntity = NormalizationSessionProjection;
