import { useReducer } from 'react';
import type { ComboboxOption } from '../combobox';

export interface AsyncComboboxState<T> {
  query: string;
  options: ComboboxOption<T>[];
  isLoading: boolean;
  isLoadingMore: boolean;
  fetchError: Error | null;
  page: number;
  hasMore: boolean;
  total: number | undefined;
}

export type AsyncComboboxAction<T> =
  | { type: 'SET_QUERY'; payload: string }
  | { type: 'SET_OPTIONS'; payload: ComboboxOption<T>[] }
  | { type: 'APPEND_OPTIONS'; payload: ComboboxOption<T>[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOADING_MORE'; payload: boolean }
  | { type: 'SET_ERROR'; payload: Error | null }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_HAS_MORE'; payload: boolean }
  | { type: 'SET_TOTAL'; payload: number | undefined }
  | { type: 'FETCH_START'; payload: { isLoadingMore: boolean } }
  | {
      type: 'FETCH_SUCCESS';
      payload: {
        items: ComboboxOption<T>[];
        hasMore: boolean;
        total?: number;
        isLoadingMore: boolean;
      };
    }
  | { type: 'FETCH_ERROR'; payload: Error }
  | { type: 'RESET_FOR_NEW_QUERY' };

function createInitialState<T>(): AsyncComboboxState<T> {
  return {
    query: '',
    options: [],
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
    case 'SET_QUERY':
      return { ...state, query: action.payload };

    case 'SET_OPTIONS':
      return { ...state, options: action.payload };

    case 'APPEND_OPTIONS':
      return { ...state, options: [...state.options, ...action.payload] };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_LOADING_MORE':
      return { ...state, isLoadingMore: action.payload };

    case 'SET_ERROR':
      return { ...state, fetchError: action.payload };

    case 'SET_PAGE':
      return { ...state, page: action.payload };

    case 'SET_HAS_MORE':
      return { ...state, hasMore: action.payload };

    case 'SET_TOTAL':
      return { ...state, total: action.payload };

    case 'FETCH_START':
      return {
        ...state,
        isLoading: !action.payload.isLoadingMore,
        isLoadingMore: action.payload.isLoadingMore,
        fetchError: null,
      };

    case 'FETCH_SUCCESS':
      return {
        ...state,
        options: action.payload.isLoadingMore
          ? [...state.options, ...action.payload.items]
          : action.payload.items,
        hasMore: action.payload.hasMore,
        total: action.payload.total,
        isLoading: false,
        isLoadingMore: false,
      };

    case 'FETCH_ERROR':
      return {
        ...state,
        fetchError: action.payload,
        options: [],
        hasMore: false,
        isLoading: false,
        isLoadingMore: false,
      };

    case 'RESET_FOR_NEW_QUERY':
      return {
        ...state,
        page: 0,
        options: [],
        hasMore: true,
      };

    default:
      return state;
  }
}

/**
 * Manages the state for an async combobox using useReducer for better performance.
 * This approach batches related state updates and prevents unnecessary re-renders.
 *
 * Benefits over multiple useState:
 * - Single state object reduces re-renders
 * - Actions provide clear state transition logic
 * - Easier to test and reason about state changes
 * - Better for complex state with multiple interdependencies
 */
export function useAsyncComboboxState<T extends string | number>() {
  const [state, dispatch] = useReducer(asyncComboboxReducer<T>, createInitialState<T>());

  return {
    state,
    dispatch,
  };
}
