import { useCallback } from 'react';
import type { ArtifactId } from '../artifact-id';
import { useEntityStore } from '../../store/entity-store';
import {
  loadArtifactFile,
  useArtifactFile,
  type FileLoadState,
} from './artifact-file-loader-store';

/**
 * Hook for loading artifact files with automatic caching
 * Returns the current load state and a function to trigger loading
 */
export function useLoadArtifactFile(artifactId: ArtifactId) {
  const artifact = useEntityStore((state) => state.entities.artifacts.byId[artifactId]);
  const fileState = useArtifactFile(artifactId);

  const loadFile = useCallback(async (): Promise<File> => {
    if (!artifact) {
      throw new Error(`Artifact ${artifactId} not found in store`);
    }

    if (!artifact.download_url) {
      throw new Error(`Artifact ${artifactId} has no download URL`);
    }

    return loadArtifactFile(
      artifactId,
      artifact.download_url,
      artifact.filename,
      artifact.content_type,
    );
  }, [artifact, artifactId]);

  return {
    fileState,
    loadFile,
    artifact,
  };
}

/**
 * Hook for loading multiple artifact files
 * Returns a map of artifact IDs to their load states
 */
export function useLoadArtifactFiles(artifactIds: ArtifactId[]) {
  const artifacts = useEntityStore((state) =>
    artifactIds.map((id) => state.entities.artifacts.byId[id]).filter(Boolean),
  );

  const fileStates = artifactIds.reduce(
    (acc, id) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      acc[id] = useArtifactFile(id);
      return acc;
    },
    {} as Record<string, FileLoadState>,
  );

  const loadFiles = useCallback(async (): Promise<File[]> => {
    const promises = artifacts.map((artifact) => {
      if (!artifact.download_url) {
        throw new Error(`Artifact ${artifact.id} has no download URL`);
      }
      return loadArtifactFile(
        artifact.id as ArtifactId,
        artifact.download_url,
        artifact.filename,
        artifact.content_type,
      );
    });

    return Promise.all(promises);
  }, [artifacts]);

  return {
    fileStates,
    loadFiles,
    artifacts,
  };
}
