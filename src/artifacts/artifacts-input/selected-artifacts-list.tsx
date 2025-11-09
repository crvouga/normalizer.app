import * as React from 'react';
import type { ArtifactId } from '../artifact-id';
import { useEntityStoreSelector } from '../../store/entity-store';
import { TabularFileList } from '~/src/ui/tabular-file-input/tabular-file-list';
import { artifactToTabularFile } from './artifact-to-tabular-file';

export interface SelectedArtifactsListProps {
  artifacts: ArtifactId[];
  onRemove: (artifactId: ArtifactId) => void;
  onClearAll?: () => void;
  title: string;
  showPreview?: boolean;
}

/**
 * Component for displaying a list of selected artifacts using TabularFileList.
 * Only renders when there are artifacts to display.
 * Fetches artifact entities from the entity store and converts them to TabularFiles.
 * Files are lazy-loaded on-demand when previews are requested.
 */
export function SelectedArtifactsList({
  artifacts,
  onRemove,
  onClearAll,
  title,
  showPreview = true,
}: SelectedArtifactsListProps) {
  const artifactsById = useEntityStoreSelector((state) => state.entities.artifacts.byId);
  const [showPreviews, setShowPreviews] = React.useState<Record<number, boolean>>({});

  // Convert artifacts to TabularFiles
  const tabularFiles = React.useMemo(() => {
    return artifacts
      .map((id) => artifactsById[id])
      .filter(Boolean)
      .map(artifactToTabularFile);
  }, [artifacts, artifactsById]);

  const handleTogglePreview = React.useCallback((index: number) => {
    setShowPreviews((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  }, []);

  const handleRemoveFile = React.useCallback(
    (index: number) => {
      const artifactId = artifacts[index];
      if (artifactId) {
        onRemove(artifactId);
      }
    },
    [artifacts, onRemove],
  );

  const handleClearAll = React.useCallback(() => {
    setShowPreviews({});
    onClearAll?.();
  }, [onClearAll]);

  if (artifacts.length === 0) {
    return null;
  }

  return (
    <TabularFileList
      files={tabularFiles}
      title={title}
      showPreview={showPreview}
      showPreviews={showPreviews}
      onTogglePreview={handleTogglePreview}
      onRemoveFile={handleRemoveFile}
      onClearAll={handleClearAll}
    />
  );
}
