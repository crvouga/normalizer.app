import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { Store } from './store';

// Generic types
export type EntitySlice<TId extends string = string, TEntity = unknown> = {
  byId: Record<TId, TEntity>;
  allIds: TId[];
};

export type EntityWithId<TId extends string = string> = { id: TId };

export type IndexDefinition = {
  // Extract the index key from an entity (e.g., sessionId from an event)
  getIndexKey: (entity: unknown) => string | undefined;
  // Get the entity id to store in the index
  getEntityId: (entity: unknown) => string;
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

        const entityId = entity.id;
        const entityExists = entityId in slice.byId;
        const oldEntity = entityExists ? slice.byId[entityId as keyof typeof slice.byId] : null;

        const newState = {
          ...state,
          entities: {
            ...state.entities,
            [entityType]: {
              byId: { ...slice.byId, [entityId]: entity },
              allIds: entityExists ? slice.allIds : [...slice.allIds, entityId],
            },
          },
        };

        // Remove from old indexes if entity existed and index keys might have changed
        let stateAfterIndexRemoval = newState;
        if (entityExists && oldEntity) {
          stateAfterIndexRemoval = removeFromIndexes(
            newState,
            entityType,
            oldEntity,
            indexDefinitions,
          );
        }

        // Add/update indexes
        return updateIndexesForEntity(stateAfterIndexRemoval, entityType, entity, indexDefinitions);
      }

      case 'entity/ADD_MANY': {
        const { entityType, entities } = action;
        const slice = state.entities[entityType];
        if (!slice) return state;

        const newById = { ...slice.byId };
        const newIds: string[] = [];
        const oldEntitiesMap = new Map<string, unknown>();

        // Helper function to perform one-level-deep upsert
        const upsertEntity = (oldEntity: unknown, newEntity: unknown): unknown => {
          if (
            !oldEntity ||
            typeof oldEntity !== 'object' ||
            !newEntity ||
            typeof newEntity !== 'object'
          ) {
            return newEntity;
          }

          // Create a shallow merge: top-level properties from newEntity, but keep oldEntity's nested objects if not in newEntity
          const merged = { ...(oldEntity as Record<string, unknown>) };
          const newEntityRecord = newEntity as Record<string, unknown>;
          for (const key in newEntityRecord) {
            if (Object.prototype.hasOwnProperty.call(newEntityRecord, key)) {
              // For one-level deep, we replace nested objects/arrays entirely, not merge recursively
              merged[key] = newEntityRecord[key];
            }
          }
          return merged;
        };

        for (const entity of entities) {
          if (
            entity &&
            typeof entity === 'object' &&
            'id' in entity &&
            typeof entity.id === 'string'
          ) {
            const entityId = entity.id;
            if (entityId in newById) {
              const oldEntity = newById[entityId];
              oldEntitiesMap.set(entityId, oldEntity);
              // Perform one-level-deep upsert
              newById[entityId] = upsertEntity(oldEntity, entity);
            } else {
              newIds.push(entityId);
              newById[entityId] = entity;
            }
          }
        }

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

        // Remove old entities from indexes
        for (const [, oldEntity] of oldEntitiesMap) {
          newState = removeFromIndexes(newState, entityType, oldEntity, indexDefinitions);
        }

        // Add/update indexes for all entities
        for (const entity of entities) {
          newState = updateIndexesForEntity(newState, entityType, entity, indexDefinitions);
        }

        return newState;
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
              allIds: slice.allIds.filter((entityId: string) => entityId !== id),
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

function removeFromIndexes<TStore extends StoreConfig<any>>(
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
    if (!newState.indexes || !newState.indexes[indexName]) continue;

    const existingIndex = newState.indexes[indexName];
    const existingEntities = existingIndex[indexKey] || [];

    // Only update if entity is in the index
    if (existingEntities.includes(entityId)) {
      newState = {
        ...newState,
        indexes: {
          ...newState.indexes,
          [indexName]: {
            ...existingIndex,
            [indexKey]: existingEntities.filter((id) => id !== entityId),
          },
        },
      };
    }
  }

  return newState;
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

    const existingIndex = (newState.indexes && newState.indexes[indexName]) || {};
    const existingEntities = existingIndex[indexKey] || [];

    // Only add if not already in the index (prevent duplicates)
    if (!existingEntities.includes(entityId)) {
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
  }

  return newState;
}

// Type helpers to extract entity type info from store
type ExtractEntityType<TStore extends StoreConfig<any>, TKey extends keyof TStore['entities']> =
  TStore['entities'][TKey] extends EntitySlice<any, infer TEntity> ? TEntity : never;

type ExtractEntityId<TStore extends StoreConfig<any>, TKey extends keyof TStore['entities']> =
  TStore['entities'][TKey] extends EntitySlice<infer TId, any> ? TId : never;

// Shallow equality check for objects and arrays
function shallowEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true;

  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !Object.is(a[key], b[key])) {
      return false;
    }
  }

  return true;
}

// Generic hook factory
export function createEntityStoreHooks<TStore extends StoreConfig<any>>(
  store: Store<TStore>,
  dispatch: (action: StoreAction) => void,
) {
  function useSelector<T>(
    selector: (state: TStore) => T,
    equalityFn: (a: T, b: T) => boolean = shallowEqual,
  ): T {
    // Use refs to avoid recreating getSnapshot on every render
    const selectorRef = useRef(selector);
    const equalityFnRef = useRef(equalityFn);
    const selectedValueRef = useRef<T | undefined>(undefined);
    const hasValueRef = useRef(false);

    // Always update refs to latest values
    selectorRef.current = selector;
    equalityFnRef.current = equalityFn;

    const getSnapshot = useCallback(() => {
      const nextValue = selectorRef.current(store.getState());

      // If we have a previous value and it's equal, return the same reference
      if (hasValueRef.current && equalityFnRef.current(selectedValueRef.current as T, nextValue)) {
        return selectedValueRef.current as T;
      }

      // Update cached value and return new one
      selectedValueRef.current = nextValue;
      hasValueRef.current = true;
      return nextValue;
    }, []); // Empty deps - we use refs for everything

    return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
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

    return useMemo(
      () => ({
        addEntity,
        addManyEntities,
        removeEntity,
        resetEntity,
      }),
      [addEntity, addManyEntities, removeEntity, resetEntity],
    );
  }

  return { useSelector, useEntityStore, shallowEqual };
}
