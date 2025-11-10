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

// Discriminated union for modal state
type ModalState = { type: 'closed' } | { type: 'edit'; artifact: Artifact };

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
  const [modalState, setModalState] = React.useState<ModalState>({ type: 'closed' });

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
        setModalState({ type: 'edit', artifact });
      }
    },
    [artifacts, artifactsById],
  );

  const handleEditComplete = React.useCallback(() => {
    setModalState({ type: 'closed' });
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
        isOpen={modalState.type === 'edit'}
        onClose={() => setModalState({ type: 'closed' })}
        artifact={modalState.type === 'edit' ? modalState.artifact : null}
        onEditComplete={handleEditComplete}
      />
    </>
  );
}
