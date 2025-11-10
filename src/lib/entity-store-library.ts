import { useCallback, useSyncExternalStore } from 'react';
import { Store } from './store';

// Generic types
export type EntitySlice<TId extends string = string, TEntity = unknown> = {
  byId: Record<TId, TEntity>;
  allIds: TId[];
};

export type EntityWithId<TId extends string = string> = { id: TId };

export type IndexDefinition<TEntity = unknown> = {
  // Extract the index key from an entity (e.g., sessionId from an event)
  getIndexKey: (entity: TEntity) => string | undefined;
  // Get the entity id to store in the index
  getEntityId: (entity: TEntity) => string;
};

export type StoreConfig<TEntities extends Record<string, EntitySlice>> = {
  entities: TEntities;
  indexes?: Record<string, Record<string, string[]>>;
};

// Generic actions
export type EntityAddAction<TEntityType extends string = string, TEntity = unknown> = {
  type: 'entity/ADD';
  entityType: TEntityType;
  entity: TEntity;
};

export type EntityAddManyAction<TEntityType extends string = string, TEntity = unknown> = {
  type: 'entity/ADD_MANY';
  entityType: TEntityType;
  entities: TEntity[];
};

export type EntityUpdateAction<TEntityType extends string = string, TId extends string = string> = {
  type: 'entity/UPDATE';
  entityType: TEntityType;
  id: TId;
  changes: Record<string, unknown>;
};

export type EntityRemoveAction<TEntityType extends string = string, TId extends string = string> = {
  type: 'entity/REMOVE';
  entityType: TEntityType;
  id: TId;
};

export type EntityResetAction<TEntityType extends string = string> = {
  type: 'entity/RESET';
  entityType: TEntityType;
};

export type IndexUpdateAction = {
  type: 'index/UPDATE';
  indexName: string;
  indexKey: string;
  entityId: string;
};

export type StoreAction =
  | EntityAddAction
  | EntityAddManyAction
  | EntityUpdateAction
  | EntityRemoveAction
  | EntityResetAction
  | IndexUpdateAction;

// Generic reducer
export function createEntityStoreReducer<TStore extends StoreConfig<any>>(
  indexDefinitions: Record<string, { entityType: string; definition: IndexDefinition }>,
) {
  return (state: TStore, action: StoreAction): TStore => {
    switch (action.type) {
      case 'entity/ADD': {
        const { entityType, entity } = action;
        const slice = state.entities[entityType];
        if (!slice || !entity || typeof entity !== 'object') return state;
        if (!('id' in entity) || typeof entity.id !== 'string') return state;
        if (entity.id in slice.byId) return state;

        const entityId = entity.id;
        const newState = {
          ...state,
          entities: {
            ...state.entities,
            [entityType]: {
              byId: { ...slice.byId, [entityId]: entity },
              allIds: [...slice.allIds, entityId],
            },
          },
        };

        // Auto-update indexes
        return updateIndexesForEntity(newState, entityType, entity, indexDefinitions);
      }

      case 'entity/ADD_MANY': {
        const { entityType, entities } = action;
        const slice = state.entities[entityType];
        if (!slice) return state;

        const newById = { ...slice.byId };
        const newIds: string[] = [];

        for (const entity of entities) {
          if (
            entity &&
            typeof entity === 'object' &&
            'id' in entity &&
            typeof entity.id === 'string'
          ) {
            if (!(entity.id in newById)) {
              newById[entity.id] = entity;
              newIds.push(entity.id);
            }
          }
        }

        if (newIds.length === 0) return state;

        let newState = {
          ...state,
          entities: {
            ...state.entities,
            [entityType]: {
              byId: newById,
              allIds: [...slice.allIds, ...newIds],
            },
          },
        };

        // Auto-update indexes for all entities
        for (const entity of entities) {
          newState = updateIndexesForEntity(newState, entityType, entity, indexDefinitions);
        }

        return newState;
      }

      case 'entity/UPDATE': {
        const { entityType, id, changes } = action;
        const slice = state.entities[entityType];
        if (!slice || !(id in slice.byId)) return state;

        const existingEntity = slice.byId[id as keyof typeof slice.byId];
        if (typeof existingEntity !== 'object' || !existingEntity) return state;

        return {
          ...state,
          entities: {
            ...state.entities,
            [entityType]: {
              ...slice,
              byId: {
                ...slice.byId,
                [id]: { ...existingEntity, ...changes },
              },
            },
          },
        };
      }

      case 'entity/REMOVE': {
        const { entityType, id } = action;
        const slice = state.entities[entityType];
        if (!slice || !(id in slice.byId)) return state;

        const byIdRecord = slice.byId as Record<string, unknown>;
        const { [id]: _, ...restById } = byIdRecord;

        return {
          ...state,
          entities: {
            ...state.entities,
            [entityType]: {
              byId: restById,
              allIds: slice.allIds.filter((entityId) => entityId !== id),
            },
          },
        };
      }

      case 'entity/RESET': {
        const { entityType } = action;
        return {
          ...state,
          entities: {
            ...state.entities,
            [entityType]: {
              byId: {},
              allIds: [],
            },
          },
        };
      }

      case 'index/UPDATE': {
        const { indexName, indexKey, entityId } = action;
        if (!state.indexes) return state;

        const existingIndex = state.indexes[indexName] || {};
        const existingEntities = existingIndex[indexKey] || [];

        return {
          ...state,
          indexes: {
            ...state.indexes,
            [indexName]: {
              ...existingIndex,
              [indexKey]: [...existingEntities, entityId],
            },
          },
        };
      }

      default:
        return state;
    }
  };
}

function updateIndexesForEntity<TStore extends StoreConfig<any>>(
  state: TStore,
  entityType: string,
  entity: unknown,
  indexDefinitions: Record<string, { entityType: string; definition: IndexDefinition }>,
): TStore {
  let newState = state;

  for (const [indexName, indexConfig] of Object.entries(indexDefinitions)) {
    if (indexConfig.entityType !== entityType) continue;

    const indexKey = indexConfig.definition.getIndexKey(entity);
    if (!indexKey) continue;

    const entityId = indexConfig.definition.getEntityId(entity);
    if (!newState.indexes) {
      newState = { ...newState, indexes: {} };
    }

    const existingIndex = newState.indexes[indexName] || {};
    const existingEntities = existingIndex[indexKey] || [];

    newState = {
      ...newState,
      indexes: {
        ...newState.indexes,
        [indexName]: {
          ...existingIndex,
          [indexKey]: [...existingEntities, entityId],
        },
      },
    };
  }

  return newState;
}

// Type helpers to extract entity type info from store
type ExtractEntityType<TStore extends StoreConfig<any>, TKey extends keyof TStore['entities']> =
  TStore['entities'][TKey] extends EntitySlice<any, infer TEntity> ? TEntity : never;

type ExtractEntityId<TStore extends StoreConfig<any>, TKey extends keyof TStore['entities']> =
  TStore['entities'][TKey] extends EntitySlice<infer TId, any> ? TId : never;

// Generic hook factory
export function createEntityStoreHooks<TStore extends StoreConfig<any>>(
  store: Store<TStore>,
  dispatch: (action: StoreAction) => void,
) {
  function useSelector<T>(selector: (state: TStore) => T): T {
    return useSyncExternalStore(
      store.subscribe,
      () => selector(store.getState()),
      () => selector(store.getState()),
    );
  }

  function useEntityStore() {
    const optimizedDispatch = useCallback(dispatch, []);

    const addEntity = useCallback(
      <TKey extends keyof TStore['entities']>(
        entityType: TKey,
        entity: ExtractEntityType<TStore, TKey>,
      ) => {
        optimizedDispatch({
          type: 'entity/ADD',
          entityType: entityType as string,
          entity,
        });
      },
      [optimizedDispatch],
    );

    const addManyEntities = useCallback(
      <TKey extends keyof TStore['entities']>(
        entityType: TKey,
        entities: ExtractEntityType<TStore, TKey>[],
      ) => {
        optimizedDispatch({
          type: 'entity/ADD_MANY',
          entityType: entityType as string,
          entities,
        });
      },
      [optimizedDispatch],
    );

    const updateEntity = useCallback(
      <TKey extends keyof TStore['entities']>(
        entityType: TKey,
        id: ExtractEntityId<TStore, TKey>,
        changes: Partial<ExtractEntityType<TStore, TKey>>,
      ) => {
        optimizedDispatch({
          type: 'entity/UPDATE',
          entityType: entityType as string,
          id: id as string,
          changes: changes as Record<string, unknown>,
        });
      },
      [optimizedDispatch],
    );

    const removeEntity = useCallback(
      <TKey extends keyof TStore['entities']>(
        entityType: TKey,
        id: ExtractEntityId<TStore, TKey>,
      ) => {
        optimizedDispatch({
          type: 'entity/REMOVE',
          entityType: entityType as string,
          id: id as string,
        });
      },
      [optimizedDispatch],
    );

    const resetEntity = useCallback(
      <TKey extends keyof TStore['entities']>(entityType: TKey) => {
        optimizedDispatch({
          type: 'entity/RESET',
          entityType: entityType as string,
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
    };
  }

  return { useSelector, useEntityStore };
}
