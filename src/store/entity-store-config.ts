import type { Artifact } from '../artifacts/artifact';
import type { ArtifactId } from '../artifacts/artifact-id';
import type { User } from '../users/user';
import type { UserId } from '../users/user-id';
import type { NormalizationSessionEventEntity } from '../normalization-session/normalization-session-event-entity';
import type { NormalizationSessionEventId } from '../normalization-session/normalization-session-event-id';
import type { NormalizationSessionId } from '../normalization-session/normalization-session-id';
import type { EntitySlice, IndexDefinition } from '../lib/entity-store-library';

// Define entity types
export type EntityStore = {
  entities: {
    artifacts: EntitySlice<ArtifactId, Artifact>;
    users: EntitySlice<UserId, User>;
    normalizationSessionEvents: EntitySlice<
      NormalizationSessionEventId,
      NormalizationSessionEventEntity
    >;
  };
  indexes: {
    normalizationSessionEventsBySessionId: Record<
      NormalizationSessionId,
      NormalizationSessionEventId[]
    >;
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
  },
  indexes: {
    normalizationSessionEventsBySessionId: {},
  },
};

// Define indexes declaratively
export const indexDefinitions = {
  normalizationSessionEventsBySessionId: {
    entityType: 'normalizationSessionEvents' as const,
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
};

// Type helpers for better DX
export type EntityType = keyof EntityStore['entities'];

// Entity accessors
export type ArtifactEntity = Artifact;
export type UserEntity = User;
export type NormalizationSessionEvent = NormalizationSessionEventEntity;
