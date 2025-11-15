import * as React from 'react';
import type { ArtifactId } from '../artifact-id';
import { useEntityStoreSelector } from '../../store/entity-store';
import {
  TabularFileItem,
  TabularFileItemSkeleton,
  type TabularFileAction,
} from '~/src/ui/tabular-file-input/tabular-file-item';
import { artifactToTabularFile } from './artifact-to-tabular-file';
import { EditArtifactModal } from '../edit-artifact/edit-artifact-modal';
import type { Artifact } from '../artifact';
import { useI18n } from '../../i18n/use-i18n';
import { IconPencil } from '~/src/ui/icons';

export interface SelectedArtifactsListProps {
  artifacts: ArtifactId[];
  onRemove: (artifactId: ArtifactId) => void;
  onClearAll?: () => void;
  showPreview?: boolean;
  readOnly?: boolean;
}

// Discriminated union for modal state

type ModalState =
  | { type: 'closed'; artifact?: Artifact | null }
  | { type: 'edit'; artifact: Artifact };

export function SelectedArtifactsList({
  artifacts,
  onRemove,
  onClearAll,
  showPreview = true,
  readOnly = false,
}: SelectedArtifactsListProps) {
  const { t } = useI18n();
  const artifactsById = useEntityStoreSelector((state) => state.entities.artifacts.byId);
  const [showPreviews, setShowPreviews] = React.useState<Record<number, boolean>>({});
  const [modalState, setModalState] = React.useState<ModalState>({ type: 'closed' });

  // Convert artifacts to TabularFiles
  const tabularFiles = React.useMemo(() => {
    return artifacts
      .map((id) => artifactsById[id])
      .filter((artifact): artifact is NonNullable<typeof artifact> => artifact !== undefined)
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
    (_file: any, index: number) => {
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

  // Create a map of artifact index to tabular file index
  const artifactIndexToFileIndex = React.useMemo(() => {
    const map = new Map<number, number>();
    let fileIndex = 0;
    artifacts.forEach((id, artifactIndex) => {
      if (artifactsById[id]) {
        map.set(artifactIndex, fileIndex);
        fileIndex++;
      }
    });
    return map;
  }, [artifacts, artifactsById]);

  // Create a reverse map for removing files
  const fileIndexToArtifactIndex = React.useMemo(() => {
    const map = new Map<number, number>();
    let fileIndex = 0;
    artifacts.forEach((id, artifactIndex) => {
      if (artifactsById[id]) {
        map.set(fileIndex, artifactIndex);
        fileIndex++;
      }
    });
    return map;
  }, [artifacts, artifactsById]);

  const handleRemoveFileFromList = React.useCallback(
    (fileIndex: number) => {
      const artifactIndex = fileIndexToArtifactIndex.get(fileIndex);
      if (artifactIndex !== undefined) {
        handleRemoveFile(artifactIndex);
      }
    },
    [fileIndexToArtifactIndex, handleRemoveFile],
  );

  const handleTogglePreviewFromList = React.useCallback(
    (fileIndex: number) => {
      const artifactIndex = fileIndexToArtifactIndex.get(fileIndex);
      if (artifactIndex !== undefined) {
        handleTogglePreview(artifactIndex);
      }
    },
    [fileIndexToArtifactIndex, handleTogglePreview],
  );

  const handleEditFromList = React.useCallback(
    (_file: any, fileIndex: number) => {
      const artifactIndex = fileIndexToArtifactIndex.get(fileIndex);
      if (artifactIndex !== undefined) {
        handleEdit(_file, artifactIndex);
      }
    },
    [fileIndexToArtifactIndex, handleEdit],
  );

  // Map showPreviews from artifact indices to file indices
  const showPreviewsForFiles = React.useMemo(() => {
    const mapped: Record<number, boolean> = {};
    Object.entries(showPreviews).forEach(([artifactIndexStr, value]) => {
      const artifactIndex = Number(artifactIndexStr);
      const fileIndex = artifactIndexToFileIndex.get(artifactIndex);
      if (fileIndex !== undefined) {
        mapped[fileIndex] = value;
      }
    });
    return mapped;
  }, [showPreviews, artifactIndexToFileIndex]);

  const customActionsForFiles: TabularFileAction[] = React.useMemo(
    () => [
      {
        label: t('artifact.edit'),
        onClick: handleEditFromList,
        icon: IconPencil,
      },
    ],
    [t, handleEditFromList],
  );

  if (artifacts.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3">
        {artifacts.map((artifactId, artifactIndex) => {
          const artifact = artifactsById[artifactId];
          if (!artifact) return <TabularFileItemSkeleton key={artifactId} />;

          const fileIndex = artifactIndexToFileIndex.get(artifactIndex);
          if (fileIndex === undefined) return <TabularFileItemSkeleton key={artifactId} />;

          const tabularFile = tabularFiles[fileIndex];
          if (!tabularFile) return <TabularFileItemSkeleton key={artifactId} />;

          return (
            <TabularFileItem
              key={artifactId}
              tabularFile={tabularFile}
              index={fileIndex}
              showPreview={showPreview}
              isPreviewVisible={showPreviewsForFiles[fileIndex] || false}
              onTogglePreview={handleTogglePreviewFromList}
              onRemove={handleRemoveFileFromList}
              customActions={customActionsForFiles}
              readOnly={readOnly}
            />
          );
        })}
        {!readOnly && (
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearAll}
                className="rounded px-2 py-1 text-xs text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                {t('tabularFileInput.clearAll')}
              </button>
            </div>
          </div>
        )}
      </div>
      <EditArtifactModal
        isOpen={modalState.type === 'edit'}
        onClose={() => setModalState({ type: 'closed' })}
        artifact={modalState.type === 'edit' ? modalState.artifact : null}
        onEditComplete={handleEditComplete}
      />
    </>
  );
}
