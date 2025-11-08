import { useSyncExternalStore } from 'react';
import type { Artifact } from '../artifacts/artifact';
import type { ArtifactId } from '../artifacts/artifact-id';

// Store type
export type Store = {
  entities: {
    artifacts: {
      byId: Record<ArtifactId, Artifact>;
      allIds: ArtifactId[];
    };
  };
  indexes: {};
};

// Generic actions for any entity type
export type StoreAction =
  | { type: 'entity/ADD'; entityType: keyof Store['entities']; entity: any }
  | { type: 'entity/ADD_MANY'; entityType: keyof Store['entities']; entities: any[] }
  | { type: 'entity/UPDATE'; entityType: keyof Store['entities']; id: string; changes: any }
  | { type: 'entity/REMOVE'; entityType: keyof Store['entities']; id: string }
  | { type: 'entity/RESET'; entityType: keyof Store['entities'] };

// Initial state
const initialStore: Store = {
  entities: {
    artifacts: {
      byId: {},
      allIds: [],
    },
  },
  indexes: {},
};

// Generic reducer that works with any entity
function storeReducer(state: Store, action: StoreAction): Store {
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
      } as Store;
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
      } as Store;
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
      } as Store;
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
      } as Store;
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
      } as Store;
    }

    default:
      return state;
  }
}

// External store implementation
class ExternalStore {
  private state: Store = initialStore;
  private listeners = new Set<() => void>();

  getState = (): Store => {
    return this.state;
  };

  setState = (newState: Store): void => {
    this.state = newState;
    this.emitChange();
  };

  dispatch = (action: StoreAction): void => {
    this.setState(storeReducer(this.state, action));
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emitChange = (): void => {
    for (const listener of this.listeners) {
      listener();
    }
  };
}

// Create the store instance
export const store = new ExternalStore();

// Hook with selector for optimized re-renders
export function useStore<T>(selector: (state: Store) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

// Dispatch function for actions
export function dispatch(action: StoreAction): void {
  store.dispatch(action);
}

// Convenience hooks for specific entities

export function useArtifacts(): Artifact[] {
  return useStore((state) =>
    state.entities.artifacts.allIds.map((id) => state.entities.artifacts.byId[id]),
  );
}

export function useArtifact(id: ArtifactId): Artifact | undefined {
  return useStore((state) => state.entities.artifacts.byId[id]);
}

export function useArtifactIds(): ArtifactId[] {
  return useStore((state) => state.entities.artifacts.allIds);
}
