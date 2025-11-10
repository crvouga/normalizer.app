import { useCallback, useSyncExternalStore } from 'react';
import type { Artifact } from '../artifacts/artifact';
import type { ArtifactId } from '../artifacts/artifact-id';
import type { User } from '../users/user';
import type { UserId } from '../users/user-id';
import type { NormalizationSessionEventEntity } from '../normalization-session/normalization-session-event-entity';
import type { NormalizationSessionEventId } from '../normalization-session/normalization-session-event-id';
import type { NormalizationSessionId } from '../normalization-session/normalization-session-id';
import { Store } from '../lib/store';

// Entity slice type
type EntitySlice<TId extends string = string, TEntity = unknown> = {
  byId: Record<TId, TEntity>;
  allIds: TId[];
};

// Store type
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

// Helper type to extract entity type from a slice
type EntityFromSlice<T> = T extends EntitySlice<string, infer E> ? E : never;

// Helper type to extract ID type from a slice
type IdFromSlice<T> = T extends EntitySlice<infer I, unknown> ? I : never;

// Type-safe actions for each entity type
type EntityAddAction = {
  [K in keyof EntityStore['entities']]: {
    type: 'entity/ADD';
    entityType: K;
    entity: EntityFromSlice<EntityStore['entities'][K]>;
  };
}[keyof EntityStore['entities']];

type EntityAddManyAction = {
  [K in keyof EntityStore['entities']]: {
    type: 'entity/ADD_MANY';
    entityType: K;
    entities: EntityFromSlice<EntityStore['entities'][K]>[];
  };
}[keyof EntityStore['entities']];

type EntityUpdateAction = {
  [K in keyof EntityStore['entities']]: {
    type: 'entity/UPDATE';
    entityType: K;
    id: IdFromSlice<EntityStore['entities'][K]>;
    changes: Partial<EntityFromSlice<EntityStore['entities'][K]>>;
  };
}[keyof EntityStore['entities']];

type EntityRemoveAction = {
  [K in keyof EntityStore['entities']]: {
    type: 'entity/REMOVE';
    entityType: K;
    id: IdFromSlice<EntityStore['entities'][K]>;
  };
}[keyof EntityStore['entities']];

type EntityResetAction = {
  [K in keyof EntityStore['entities']]: {
    type: 'entity/RESET';
    entityType: K;
  };
}[keyof EntityStore['entities']];

type IndexAddToSessionIndexAction = {
  type: 'index/ADD_TO_SESSION_INDEX';
  sessionId: NormalizationSessionId;
  eventId: NormalizationSessionEventId;
};

type IndexClearSessionIndexAction = {
  type: 'index/CLEAR_SESSION_INDEX';
  sessionId: NormalizationSessionId;
};

export type EntityStoreAction =
  | EntityAddAction
  | EntityAddManyAction
  | EntityUpdateAction
  | EntityRemoveAction
  | EntityResetAction
  | IndexAddToSessionIndexAction
  | IndexClearSessionIndexAction;

// Initial state
const initialEntityStore: EntityStore = {
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

// Generic reducer that works with any entity
function entityStoreReducer(state: EntityStore, action: EntityStoreAction): EntityStore {
  switch (action.type) {
    case 'entity/ADD': {
      const { entityType, entity } = action;
      const slice = state.entities[entityType];

      // Type guard to ensure entity has an id property
      if (!('id' in entity)) return state;
      if (entity.id in slice.byId) return state;

      const newState = {
        ...state,
        entities: {
          ...state.entities,
          [entityType]: {
            byId: { ...slice.byId, [entity.id]: entity },
            allIds: [...slice.allIds, entity.id],
          } as EntityStore['entities'][typeof entityType],
        },
      };

      // Automatically update index for normalization session events
      if (entityType === 'normalizationSessionEvents' && 'normalization_session_id' in entity) {
        const sessionId = (entity as NormalizationSessionEventEntity).normalization_session_id;
        const eventId = entity.id as NormalizationSessionEventId;
        const existingEvents =
          newState.indexes.normalizationSessionEventsBySessionId[sessionId] || [];

        return {
          ...newState,
          indexes: {
            ...newState.indexes,
            normalizationSessionEventsBySessionId: {
              ...newState.indexes.normalizationSessionEventsBySessionId,
              [sessionId]: [...existingEvents, eventId],
            },
          },
        };
      }

      return newState;
    }

    case 'entity/ADD_MANY': {
      const { entityType, entities } = action;
      const slice = state.entities[entityType];
      const newById = { ...slice.byId } as Record<string, unknown>;
      const newIds: IdFromSlice<typeof slice>[] = [];

      for (const entity of entities) {
        // Type guard to ensure entity has an id property
        if (!('id' in entity)) continue;
        if (!(entity.id in newById)) {
          newById[entity.id as string] = entity;
          newIds.push(entity.id as IdFromSlice<typeof slice>);
        }
      }

      const newState = {
        ...state,
        entities: {
          ...state.entities,
          [entityType]: {
            byId: newById as typeof slice.byId,
            allIds: [...slice.allIds, ...newIds],
          } as EntityStore['entities'][typeof entityType],
        },
      };

      // Automatically update index for normalization session events
      if (entityType === 'normalizationSessionEvents') {
        const updatedIndex = { ...newState.indexes.normalizationSessionEventsBySessionId };

        for (const entity of entities) {
          if ('id' in entity && 'normalization_session_id' in entity) {
            const sessionId = (entity as NormalizationSessionEventEntity).normalization_session_id;
            const eventId = entity.id as NormalizationSessionEventId;
            const existingEvents = updatedIndex[sessionId] || [];
            updatedIndex[sessionId] = [...existingEvents, eventId];
          }
        }

        return {
          ...newState,
          indexes: {
            ...newState.indexes,
            normalizationSessionEventsBySessionId: updatedIndex,
          },
        };
      }

      return newState;
    }

    case 'entity/UPDATE': {
      const { entityType, id, changes } = action;
      const slice = state.entities[entityType];
      if (!(id in slice.byId)) return state;

      const existingEntity = slice.byId[id as keyof typeof slice.byId];

      return {
        ...state,
        entities: {
          ...state.entities,
          [entityType]: {
            ...slice,
            byId: {
              ...slice.byId,
              [id]: { ...existingEntity, ...changes } as typeof existingEntity,
            },
          } as EntityStore['entities'][typeof entityType],
        },
      };
    }

    case 'entity/REMOVE': {
      const { entityType, id } = action;
      const slice = state.entities[entityType];
      if (!(id in slice.byId)) return state;

      const { [id]: _, ...restById } = slice.byId as Record<string, unknown>;

      return {
        ...state,
        entities: {
          ...state.entities,
          [entityType]: {
            byId: restById as typeof slice.byId,
            allIds: slice.allIds.filter((entityId) => entityId !== id),
          } as EntityStore['entities'][typeof entityType],
        },
      };
    }

    case 'entity/RESET': {
      const { entityType } = action;
      const slice = state.entities[entityType];

      return {
        ...state,
        entities: {
          ...state.entities,
          [entityType]: {
            byId: {} as typeof slice.byId,
            allIds: [] as typeof slice.allIds,
          } as EntityStore['entities'][typeof entityType],
        },
      };
    }

    case 'index/ADD_TO_SESSION_INDEX': {
      const { sessionId, eventId } = action;
      const existingEvents = state.indexes.normalizationSessionEventsBySessionId[sessionId] || [];

      return {
        ...state,
        indexes: {
          ...state.indexes,
          normalizationSessionEventsBySessionId: {
            ...state.indexes.normalizationSessionEventsBySessionId,
            [sessionId]: [...existingEvents, eventId],
          },
        },
      };
    }

    case 'index/CLEAR_SESSION_INDEX': {
      const { sessionId } = action;
      const { [sessionId]: _, ...restIndex } = state.indexes.normalizationSessionEventsBySessionId;

      return {
        ...state,
        indexes: {
          ...state.indexes,
          normalizationSessionEventsBySessionId: restIndex,
        },
      };
    }

    default:
      return state;
  }
}

// Create the store instance
const store = new Store<EntityStore>(initialEntityStore);

declare global {
  interface Window {
    entityStore: Store<EntityStore>;
  }
}
if (typeof window !== 'undefined') {
  window.entityStore = store;
}

// Hook with selector for optimized re-renders
export function useEntityStoreSelector<T>(selector: (state: EntityStore) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

// Dispatch function for actions
function dispatch(action: EntityStoreAction): void {
  store.updateState((state) => entityStoreReducer(state, action));
}

export function useEntityStore() {
  const optimizedDispatch = useCallback(dispatch, []);

  const addEntity = useCallback(
    <K extends keyof EntityStore['entities']>(
      entityType: K,
      entity: EntityFromSlice<EntityStore['entities'][K]>,
    ) => {
      optimizedDispatch({
        type: 'entity/ADD',
        entityType,
        entity,
      } as EntityAddAction);
    },
    [optimizedDispatch],
  );

  const addManyEntities = useCallback(
    <K extends keyof EntityStore['entities']>(
      entityType: K,
      entities: EntityFromSlice<EntityStore['entities'][K]>[],
    ) => {
      optimizedDispatch({
        type: 'entity/ADD_MANY',
        entityType,
        entities,
      } as EntityAddManyAction);
    },
    [optimizedDispatch],
  );

  const updateEntity = useCallback(
    <K extends keyof EntityStore['entities']>(
      entityType: K,
      id: IdFromSlice<EntityStore['entities'][K]>,
      changes: Partial<EntityFromSlice<EntityStore['entities'][K]>>,
    ) => {
      optimizedDispatch({
        type: 'entity/UPDATE',
        entityType,
        id,
        changes,
      } as EntityUpdateAction);
    },
    [optimizedDispatch],
  );

  const removeEntity = useCallback(
    <K extends keyof EntityStore['entities']>(
      entityType: K,
      id: IdFromSlice<EntityStore['entities'][K]>,
    ) => {
      optimizedDispatch({
        type: 'entity/REMOVE',
        entityType,
        id,
      } as EntityRemoveAction);
    },
    [optimizedDispatch],
  );

  const resetEntity = useCallback(
    <K extends keyof EntityStore['entities']>(entityType: K) => {
      optimizedDispatch({
        type: 'entity/RESET',
        entityType,
      } as EntityResetAction);
    },
    [optimizedDispatch],
  );

  const addToSessionIndex = useCallback(
    (sessionId: NormalizationSessionId, eventId: NormalizationSessionEventId) => {
      optimizedDispatch({
        type: 'index/ADD_TO_SESSION_INDEX',
        sessionId,
        eventId,
      });
    },
    [optimizedDispatch],
  );

  const clearSessionIndex = useCallback(
    (sessionId: NormalizationSessionId) => {
      optimizedDispatch({
        type: 'index/CLEAR_SESSION_INDEX',
        sessionId,
      });
    },
    [optimizedDispatch],
  );

  return {
    addEntity,
    addManyEntities,
    updateEntity,
    removeEntity,
    resetEntity,
    addToSessionIndex,
    clearSessionIndex,
  };
}
