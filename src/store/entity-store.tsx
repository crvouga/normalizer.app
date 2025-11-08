import { useSyncExternalStore } from 'react';
import type { Artifact } from '../artifacts/artifact';
import type { ArtifactId } from '../artifacts/artifact-id';
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
  };
  indexes: {
    searchResults: Record<string, string[]>;
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

type IndexSetSearchResultsAction = {
  type: 'index/SET_SEARCH_RESULTS';
  searchKey: string;
  ids: string[];
};

type IndexClearSearchResultsAction = {
  type: 'index/CLEAR_SEARCH_RESULTS';
};

export type EntityStoreAction =
  | EntityAddAction
  | EntityAddManyAction
  | EntityUpdateAction
  | EntityRemoveAction
  | EntityResetAction
  | IndexSetSearchResultsAction
  | IndexClearSearchResultsAction;

// Initial state
const initialEntityStore: EntityStore = {
  entities: {
    artifacts: {
      byId: {},
      allIds: [],
    },
  },
  indexes: {
    searchResults: {},
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
      const newById = { ...slice.byId };
      const newIds: IdFromSlice<typeof slice>[] = [];

      for (const entity of entities) {
        // Type guard to ensure entity has an id property
        if (!('id' in entity)) continue;
        if (!(entity.id in newById)) {
          newById[entity.id as keyof typeof newById] =
            entity as (typeof newById)[keyof typeof newById];
          newIds.push(entity.id as IdFromSlice<typeof slice>);
        }
      }

      return {
        ...state,
        entities: {
          ...state.entities,
          [entityType]: {
            byId: newById,
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

    case 'index/SET_SEARCH_RESULTS': {
      const { searchKey, ids } = action;
      return {
        ...state,
        indexes: {
          ...state.indexes,
          searchResults: {
            ...state.indexes.searchResults,
            [searchKey]: ids,
          },
        },
      };
    }

    case 'index/CLEAR_SEARCH_RESULTS': {
      return {
        ...state,
        indexes: {
          ...state.indexes,
          searchResults: {},
        },
      };
    }

    default:
      return state;
  }
}

// Create the store instance
const store = new Store<EntityStore>(initialEntityStore);

// Hook with selector for optimized re-renders
export function useEntityStore<T>(selector: (state: EntityStore) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

// Dispatch function for actions
export function dispatch(action: EntityStoreAction): void {
  store.updateState((state) => entityStoreReducer(state, action));
}
