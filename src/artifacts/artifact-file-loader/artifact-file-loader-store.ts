import { useSyncExternalStore } from 'react';
import type { ArtifactId } from '../artifact-id';
import { Store } from '../../lib/store';
import { trpcClient } from '../../trpc-client';

/**
 * Represents a loaded file with its content and metadata
 */
export type LoadedFile = {
  artifactId: ArtifactId;
  file: File;
  loadedAt: Date;
};

/**
 * Loading state for a file
 */
export type FileLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; data: LoadedFile }
  | { status: 'error'; error: Error };

/**
 * Store for artifact file loading state
 */
type ArtifactFileLoaderStore = {
  // Maps artifact ID to its loaded file state
  filesByArtifactId: Record<string, FileLoadState>;
};

const initialState: ArtifactFileLoaderStore = {
  filesByArtifactId: {},
};

// Create the store instance
const store = new Store<ArtifactFileLoaderStore>(initialState);

/**
 * Hook to get the loading state of a specific artifact's file
 */
export function useArtifactFile(artifactId: ArtifactId): FileLoadState {
  return useSyncExternalStore(
    store.subscribe,
    () => store.getState().filesByArtifactId[artifactId] || { status: 'idle' },
    () => store.getState().filesByArtifactId[artifactId] || { status: 'idle' },
  );
}

/**
 * Hook to get all loaded files
 */
export function useLoadedFiles(): LoadedFile[] {
  return useSyncExternalStore(
    store.subscribe,
    () => {
      const state = store.getState();
      return Object.values(state.filesByArtifactId)
        .filter(
          (state): state is { status: 'loaded'; data: LoadedFile } => state.status === 'loaded',
        )
        .map((state) => state.data);
    },
    () => {
      const state = store.getState();
      return Object.values(state.filesByArtifactId)
        .filter(
          (state): state is { status: 'loaded'; data: LoadedFile } => state.status === 'loaded',
        )
        .map((state) => state.data);
    },
  );
}

/**
 * Load a file for an artifact from its download URL
 * Returns the cached file if already loaded, otherwise fetches from server
 */
export async function loadArtifactFile(
  artifactId: ArtifactId,
  downloadUrl: string,
  filename: string,
  contentType: string,
): Promise<File> {
  const currentState = store.getState().filesByArtifactId[artifactId];

  // Return cached file if already loaded
  if (currentState?.status === 'loaded') {
    return currentState.data.file;
  }

  // If already loading, wait for it to complete
  if (currentState?.status === 'loading') {
    return new Promise((resolve, reject) => {
      const unsubscribe = store.subscribe(() => {
        const state = store.getState().filesByArtifactId[artifactId];
        if (state?.status === 'loaded') {
          unsubscribe();
          resolve(state.data.file);
        } else if (state?.status === 'error') {
          unsubscribe();
          reject(state.error);
        }
      });
    });
  }

  // Set loading state
  store.updateState((state) => ({
    ...state,
    filesByArtifactId: {
      ...state.filesByArtifactId,
      [artifactId]: { status: 'loading' },
    },
  }));

  try {
    // Fetch the file from the download URL
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const blob = await response.blob();
    const file = new File([blob], filename, { type: contentType });

    const loadedFile: LoadedFile = {
      artifactId,
      file,
      loadedAt: new Date(),
    };

    // Store the loaded file
    store.updateState((state) => ({
      ...state,
      filesByArtifactId: {
        ...state.filesByArtifactId,
        [artifactId]: { status: 'loaded', data: loadedFile },
      },
    }));

    return file;
  } catch (error) {
    // Store the error state
    store.updateState((state) => ({
      ...state,
      filesByArtifactId: {
        ...state.filesByArtifactId,
        [artifactId]: { status: 'error', error: error as Error },
      },
    }));
    throw error;
  }
}

/**
 * Clear the loaded file for a specific artifact
 */
export function clearArtifactFile(artifactId: ArtifactId): void {
  store.updateState((state) => {
    const { [artifactId]: _, ...rest } = state.filesByArtifactId;
    return {
      ...state,
      filesByArtifactId: rest,
    };
  });
}

/**
 * Clear all loaded files
 */
export function clearAllArtifactFiles(): void {
  store.updateState((state) => ({
    ...state,
    filesByArtifactId: {},
  }));
}

/**
 * Get the current state of the store (for debugging)
 */
export function getFileLoaderState(): ArtifactFileLoaderStore {
  return store.getState();
}
