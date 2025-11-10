import * as React from 'react';
import type { ArtifactId } from '../artifact-id';

export interface UseArtifactSelectionProps {
  value: ArtifactId[];
  onChange: (value: ArtifactId[]) => void;
}

export interface UseArtifactSelectionReturn {
  selectedArtifacts: ArtifactId[];
  currentSelection: ArtifactId | null;
  addArtifact: (artifactId: ArtifactId | null) => void;
  removeArtifact: (artifactId: ArtifactId) => void;
  clearCurrentSelection: () => void;
}

/**
 * Hook for managing artifact selection state.
 * Handles adding/removing artifacts and tracking current selection.
 */
export function useArtifactSelection({
  value,
  onChange,
}: UseArtifactSelectionProps): UseArtifactSelectionReturn {
  const [currentSelection, setCurrentSelection] = React.useState<ArtifactId | null>(null);

  const addArtifact = React.useCallback(
    (artifactId: ArtifactId | null) => {
      if (artifactId && !value.includes(artifactId)) {
        onChange([...value, artifactId]);
      }
      // Clear selection after adding to allow selecting another item
      setCurrentSelection(null);
    },
    [value, onChange],
  );

  const removeArtifact = React.useCallback(
    (artifactId: ArtifactId) => {
      onChange(value.filter((id) => id !== artifactId));
    },
    [value, onChange],
  );

  const clearCurrentSelection = React.useCallback(() => {
    setCurrentSelection(null);
  }, []);

  return {
    selectedArtifacts: value,
    currentSelection,
    addArtifact,
    removeArtifact,
    clearCurrentSelection,
  };
}
