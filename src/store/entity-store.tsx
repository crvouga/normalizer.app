import { useSyncExternalStore } from 'react';
import type { Artifact } from '../artifacts/artifact';
import type { ArtifactId } from '../artifacts/artifact-id';
import { Store } from '../lib/store';

// Store type
export type EntityStore = {
  entities: {
    artifacts: {
      byId: Record<ArtifactId, Artifact>;
      allIds: ArtifactId[];
    };
  };
  indexes: {};
};

// Generic actions for any entity type
export type EntityStoreAction =
  | { type: 'entity/ADD'; entityType: keyof EntityStore['entities']; entity: any }
  | { type: 'entity/ADD_MANY'; entityType: keyof EntityStore['entities']; entities: any[] }
  | { type: 'entity/UPDATE'; entityType: keyof EntityStore['entities']; id: string; changes: any }
  | { type: 'entity/REMOVE'; entityType: keyof EntityStore['entities']; id: string }
  | { type: 'entity/RESET'; entityType: keyof EntityStore['entities'] };

// Initial state
const initialEntityStore: EntityStore = {
  entities: {
    artifacts: {
      byId: {},
      allIds: [],
    },
  },
  indexes: {},
};

// Generic reducer that works with any entity
function entityStoreReducer(state: EntityStore, action: EntityStoreAction): EntityStore {
  switch (action.type) {
    case 'entity/ADD': {
      const { entityType, entity } = action;
      const slice = state.entities[entityType] as any;
      if (slice.byId[entity.id]) return state;
      
      return {
        ...state,
        entities: {
          ...state.entities,
          [entityType]: {
            byId: { ...slice.byId, [entity.id]: entity },
            allIds: [...slice.allIds, entity.id],
          },
        },
      } as EntityStore;
    }
    
    case 'entity/ADD_MANY': {
      const { entityType, entities } = action;
      const slice = state.entities[entityType] as any;
      const newById = { ...slice.byId };
      const newIds: any[] = [];
      
      for (const entity of entities) {
        if (!newById[entity.id]) {
          newById[entity.id] = entity;
          newIds.push(entity.id);
        }
      }
      
      return {
        ...state,
        entities: {
          ...state.entities,
          [entityType]: {
            byId: newById,
            allIds: [...slice.allIds, ...newIds],
          },
        },
      } as EntityStore;
    }
    
    case 'entity/UPDATE': {
      const { entityType, id, changes } = action;
      const slice = state.entities[entityType] as any;
      if (!slice.byId[id]) return state;
      
      return {
        ...state,
        entities: {
          ...state.entities,
          [entityType]: {
            ...slice,
            byId: {
              ...slice.byId,
              [id]: { ...slice.byId[id], ...changes },
            },
          },
        },
      } as EntityStore;
    }
    
    case 'entity/REMOVE': {
      const { entityType, id } = action;
      const slice = state.entities[entityType] as any;
      if (!slice.byId[id]) return state;
      
      const { [id]: _, ...restById } = slice.byId;
      return {
        ...state,
        entities: {
          ...state.entities,
          [entityType]: {
            byId: restById,
            allIds: slice.allIds.filter((entityId: any) => entityId !== id),
          },
        },
      } as EntityStore;
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
      } as EntityStore;
    }
    
    default:
      return state;
  }
}

// Create the store instance
export const store = new Store<EntityStore>(initialEntityStore);

// Hook with selector for optimized re-renders
export function useEntityStore<T>(selector: (state: EntityStore) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState())
  );
}

// Dispatch function for actions
export function dispatch(action: EntityStoreAction): void {
  store.updateState((state) => entityStoreReducer(state, action));
}

// Convenience hooks for specific entities

export function useArtifacts(): Artifact[] {
  return useEntityStore((state) =>
    state.entities.artifacts.allIds.map((id) => state.entities.artifacts.byId[id])
  );
}

export function useArtifact(id: ArtifactId): Artifact | undefined {
  return useEntityStore((state) => state.entities.artifacts.byId[id]);
}

export function useArtifactIds(): ArtifactId[] {
  return useEntityStore((state) => state.entities.artifacts.allIds);
}

