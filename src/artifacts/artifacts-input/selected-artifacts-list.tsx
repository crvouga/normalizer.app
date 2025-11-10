import * as React from 'react';
import type { ArtifactId } from '../artifact-id';
import { useEntityStoreSelector } from '../../store/entity-store';
import { TabularFileList } from '~/src/ui/tabular-file-input/tabular-file-list';
import type { TabularFileAction } from '~/src/ui/tabular-file-input/tabular-file-item';
import { artifactToTabularFile } from './artifact-to-tabular-file';
import { EditArtifactModal } from '../edit-artifact/edit-artifact-modal';
import type { Artifact } from '../artifact';
import { useI18n } from '../../i18n/use-i18n';

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
  const { t } = useI18n();
  const artifactsById = useEntityStoreSelector((state) => state.entities.artifacts.byId);
  const [showPreviews, setShowPreviews] = React.useState<Record<number, boolean>>({});
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [selectedArtifact, setSelectedArtifact] = React.useState<Artifact | null>(null);

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

  const handleEdit = React.useCallback(
    (file: any, index: number) => {
      const artifactId = artifacts[index];
      const artifact = artifactId ? artifactsById[artifactId] : null;
      if (artifact) {
        setSelectedArtifact(artifact);
        setIsEditModalOpen(true);
      }
    },
    [artifacts, artifactsById],
  );

  const handleEditComplete = React.useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedArtifact(null);
  }, []);

  const customActions: TabularFileAction[] = React.useMemo(
    () => [
      {
        label: t('artifact.edit'),
        onClick: handleEdit,
      },
    ],
    [t, handleEdit],
  );

  if (artifacts.length === 0) {
    return null;
  }

  return (
    <>
      <TabularFileList
        files={tabularFiles}
        title={title}
        showPreview={showPreview}
        showPreviews={showPreviews}
        onTogglePreview={handleTogglePreview}
        onRemoveFile={handleRemoveFile}
        onClearAll={handleClearAll}
        customActions={customActions}
      />
      <EditArtifactModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        artifact={selectedArtifact}
        onEditComplete={handleEditComplete}
      />
    </>
  );
}
