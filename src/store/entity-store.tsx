import { useCallback, useSyncExternalStore } from 'react';
import type { Artifact } from '../artifacts/artifact';
import type { ArtifactId } from '../artifacts/artifact-id';
import type { User } from '../users/user';
import type { UserId } from '../users/user-id';
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
  };
  // Removed indexes/searchResults
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

// Remove IndexSetSearchResultsAction and IndexClearSearchResultsAction

export type EntityStoreAction =
  | EntityAddAction
  | EntityAddManyAction
  | EntityUpdateAction
  | EntityRemoveAction
  | EntityResetAction;

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
  },
  // No indexes/searchResults
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

      return {
        ...state,
        entities: {
          ...state.entities,
          [entityType]: {
            byId: { ...slice.byId, [entity.id]: entity },
            allIds: [...slice.allIds, entity.id],
          } as EntityStore['entities'][typeof entityType],
        },
      };
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

      return {
        ...state,
        entities: {
          ...state.entities,
          [entityType]: {
            byId: newById as typeof slice.byId,
            allIds: [...slice.allIds, ...newIds],
          } as EntityStore['entities'][typeof entityType],
        },
      };
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

    // Removed search results index actions

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

  return {
    addEntity,
    addManyEntities,
    updateEntity,
    removeEntity,
    resetEntity,
  };
}
