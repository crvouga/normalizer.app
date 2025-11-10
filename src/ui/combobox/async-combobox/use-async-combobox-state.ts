import { useReducer } from 'react';
import type { ComboboxOption } from '../combobox';

export interface AsyncComboboxState<T> {
  query: string;
  options: ComboboxOption<T>[];
  idsBySearchHash: Record<string, T[]>; // Cache IDs by search hash
  isLoading: boolean;
  isLoadingMore: boolean;
  fetchError: Error | null;
  page: number;
  hasMore: boolean;
  total: number | undefined;
}

export type AsyncComboboxAction<T> =
  // Event-driven actions (what happened)
  | { type: 'SEARCH_QUERY_CHANGED'; payload: string }
  | { type: 'NEW_SEARCH_INITIATED' }
  | { type: 'LOAD_MORE_REQUESTED' }
  | { type: 'SEARCH_STARTED'; payload: { isLoadingMore: boolean } }
  | {
      type: 'SEARCH_COMPLETED';
      payload: {
        items: ComboboxOption<T>[];
        hasMore: boolean;
        total?: number;
        isLoadingMore: boolean;
        searchHash: string;
        ids: T[];
      };
    }
  | { type: 'SEARCH_FAILED'; payload: Error }
  | { type: 'CACHED_RESULTS_FOUND'; payload: { items: ComboboxOption<T>[] } }
  // CRUD-style actions (kept where they're the best fit for direct state manipulation)
  | { type: 'SET_OPTIONS'; payload: ComboboxOption<T>[] }
  | { type: 'SET_HAS_MORE'; payload: boolean };

function createInitialState<T>(): AsyncComboboxState<T> {
  return {
    query: '',
    options: [],
    idsBySearchHash: {},
    isLoading: false,
    isLoadingMore: false,
    fetchError: null,
    page: 0,
    hasMore: true,
    total: undefined,
  };
}

function asyncComboboxReducer<T>(
  state: AsyncComboboxState<T>,
  action: AsyncComboboxAction<T>,
): AsyncComboboxState<T> {
  switch (action.type) {
    // Event-driven actions
    case 'SEARCH_QUERY_CHANGED':
      return { ...state, query: action.payload };

    case 'NEW_SEARCH_INITIATED':
      return {
        ...state,
        page: 0,
        options: [],
        hasMore: true,
      };

    case 'LOAD_MORE_REQUESTED':
      return {
        ...state,
        page: state.page + 1,
      };

    case 'SEARCH_STARTED':
      return {
        ...state,
        isLoading: !action.payload.isLoadingMore,
        isLoadingMore: action.payload.isLoadingMore,
        fetchError: null,
      };

    case 'SEARCH_COMPLETED':
      return {
        ...state,
        options: action.payload.isLoadingMore
          ? [...state.options, ...action.payload.items]
          : action.payload.items,
        hasMore: action.payload.hasMore,
        total: action.payload.total,
        isLoading: false,
        isLoadingMore: false,
        idsBySearchHash: {
          ...state.idsBySearchHash,
          [action.payload.searchHash]: action.payload.ids,
        },
      };

    case 'SEARCH_FAILED':
      return {
        ...state,
        fetchError: action.payload,
        options: [],
        hasMore: false,
        isLoading: false,
        isLoadingMore: false,
      };

    case 'CACHED_RESULTS_FOUND':
      return {
        ...state,
        options: action.payload.items,
        isLoading: false,
        isLoadingMore: false,
      };

    // CRUD-style actions (kept where appropriate)
    case 'SET_OPTIONS':
      return { ...state, options: action.payload };

    case 'SET_HAS_MORE':
      return { ...state, hasMore: action.payload };

    default:
      return state;
  }
}

/**
 * Manages the state for an async combobox using useReducer with event-driven actions.
 * This approach batches related state updates and prevents unnecessary re-renders.
 *
 * Benefits over multiple useState:
 * - Single state object reduces re-renders
 * - Event-driven actions provide semantic meaning (what happened vs. what to set)
 * - Actions provide clear state transition logic
 * - Easier to test and reason about state changes
 * - Better for complex state with multiple interdependencies
 *
 * Action Design Philosophy:
 * - Event-driven actions describe what happened (e.g., SEARCH_STARTED, SEARCH_COMPLETED)
 * - CRUD actions (SET_X) are kept only where they're the best fit for direct state manipulation
 * - This makes the code more maintainable and easier to understand the flow of events
 */
export function useAsyncComboboxState<T extends string | number>() {
  const [state, dispatch] = useReducer(asyncComboboxReducer<T>, createInitialState<T>());

  return {
    state,
    dispatch,
  };
}
