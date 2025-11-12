import { Store } from '../lib/store';
import { createEntityStoreReducer, createEntityStoreHooks } from '../lib/entity-store-library';
import type { EntityStore } from './entity-store-config';
import { initialEntityStore, indexDefinitions } from './entity-store-config';

// Create reducer with index definitions
const reducer = createEntityStoreReducer<EntityStore>(indexDefinitions as any);

// Create store instance
const store = new Store<EntityStore>(initialEntityStore);

// Expose store globally for debugging
declare global {
  interface Window {
    entityStore: Store<EntityStore>;
  }
}
if (typeof window !== 'undefined') {
  window.entityStore = store;
}

// Dispatch function
function dispatch(action: Parameters<typeof reducer>[1]): void {
  store.updateState((state) => reducer(state, action));
}

// Create and export hooks
const { useSelector, useEntityStore, shallowEqual } = createEntityStoreHooks(store, dispatch);

export const useEntityStoreSelector = useSelector;
export { useEntityStore, shallowEqual };
export type { EntityStore } from './entity-store-config';
