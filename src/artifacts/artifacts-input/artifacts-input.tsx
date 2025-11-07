import * as React from 'react';
import { AsyncCombobox } from '~/src/ui/combobox/async-combobox';
import { useI18n } from '../../i18n/use-i18n';
import type { IArtifact } from '../../db/schema';
import type { ArtifactId } from '../artifact-id';
import { ArtifactOptionItem } from './artifact-option-item';
import { ArtifactUploadButton } from './artifact-upload-button';
import { SelectedArtifactsList } from './selected-artifacts-list';
import { useArtifactSelection } from './use-artifact-selection';
import { useFetchArtifacts } from './use-fetch-artifacts';

export type ArtifactsInputProps = {
  value: ArtifactId[];
  onChange: (value: ArtifactId[]) => void;
};

/**
 * Input component for selecting multiple artifacts.
 * Uses an async combobox with search, pagination, and displays selected items as removable badges.
 */
export function ArtifactsInput(props: ArtifactsInputProps) {
  const { t } = useI18n();

  // Track which artifacts are currently uploading
  const [uploadingArtifacts, setUploadingArtifacts] = React.useState<Set<ArtifactId>>(new Set());

  // Custom hooks for state management
  const { currentSelection, addArtifact, removeArtifact } = useArtifactSelection({
    value: props.value,
    onChange: props.onChange,
  });

  const { fetchArtifacts } = useFetchArtifacts();

  // Handle upload start - add artifact to selection with uploading state
  const handleUploadStart = React.useCallback(
    (file: File) => {
      // Generate a temporary ID for the uploading artifact
      // We'll use the filename as a temporary ID until we get the real ID
      const tempId = `uploading-${file.name}-${Date.now()}` as ArtifactId;
      setUploadingArtifacts((prev) => new Set(prev).add(tempId));
      addArtifact(tempId);
    },
    [addArtifact],
  );

  // Handle upload complete - update the artifact ID
  const handleUploadComplete = React.useCallback(
    (artifact: IArtifact) => {
      // Remove from uploading state
      setUploadingArtifacts((prev) => {
        const next = new Set(prev);
        // Find and remove the temporary uploading entry
        for (const id of next) {
          if (id.startsWith('uploading-')) {
            next.delete(id);
            // Replace the temporary ID with the real artifact ID
            const currentArtifacts = props.value.filter((id) => !id.startsWith('uploading-'));
            props.onChange([...currentArtifacts, artifact.id as ArtifactId]);
            break;
          }
        }
        return next;
      });
    },
    [props],
  );

  // Handle upload error - remove from uploading state and selection
  const handleUploadError = React.useCallback(
    (error: Error) => {
      console.error('Upload failed:', error);
      // Remove the uploading artifact from selection
      setUploadingArtifacts((prev) => {
        const next = new Set(prev);
        for (const id of next) {
          if (id.startsWith('uploading-')) {
            next.delete(id);
            removeArtifact(id);
            break;
          }
        }
        return next;
      });
    },
    [removeArtifact],
  );

  // Memoized render function for artifact options
  const renderOption = React.useCallback(
    (option: Parameters<typeof ArtifactOptionItem>[0]['option'], selected: boolean) => (
      <ArtifactOptionItem option={option} selected={selected} />
    ),
    [],
  );

  // Memoized upload button
  const uploadButton = React.useMemo(
    () => (
      <ArtifactUploadButton
        onUploadStart={handleUploadStart}
        onUploadComplete={handleUploadComplete}
        onUploadError={handleUploadError}
      />
    ),
    [handleUploadStart, handleUploadComplete, handleUploadError],
  );

  return (
    <div className="space-y-4">
      <AsyncCombobox
        value={currentSelection}
        onChange={addArtifact}
        fetchOptions={fetchArtifacts}
        placeholder={t('artifact.searchPlaceholder')}
        label={t('artifact.label')}
        helperText={t('artifact.helperText')}
        renderOption={renderOption}
        debounceMs={300}
        pageSize={20}
        actionButton={uploadButton}
      />

      <SelectedArtifactsList
        artifacts={props.value}
        onRemove={removeArtifact}
        title={t('artifact.selectedArtifacts')}
        uploadingArtifacts={uploadingArtifacts}
      />
    </div>
  );
}
