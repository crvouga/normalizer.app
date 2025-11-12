import { useCallback } from 'react';
import { AsyncCombobox } from '~/src/ui/combobox/async-combobox';
import { useI18n } from '../../i18n/use-i18n';
import type { Artifact } from '../artifact';
import type { ArtifactId } from '../artifact-id';
import { ArtifactOptionItem } from './artifact-option-item';
import { ArtifactUploadComboboxActionButton } from '../artifact-upload/artifact-upload-combobox-action-button';
import { SelectedArtifactsList } from './selected-artifacts-list';
import { useArtifactSelection } from './use-artifact-selection';
import { useFetchArtifacts } from './use-fetch-artifacts';
import type { Result } from '~/src/lib/result';

export type ArtifactsInputProps = {
  value: ArtifactId[];
  onChange: (value: ArtifactId[]) => void;
  limit?: number;
};

/**
 * Input component for selecting multiple artifacts.
 * Uses an async combobox with search, pagination, and displays selected items as removable badges.
 */
export function ArtifactsInput(props: ArtifactsInputProps) {
  const { t } = useI18n();
  const limit = props.limit ?? 1;

  // Custom hooks for state management
  const { currentSelection, addArtifact, removeArtifact } = useArtifactSelection({
    value: props.value,
    onChange: props.onChange,
  });

  const { fetchArtifactIds, getArtifactOptions } = useFetchArtifacts();

  // Handle upload complete - add artifact to selection
  const handleUploadComplete = useCallback(
    (artifact: Result<Artifact, Error>) => {
      switch (artifact.tag) {
        case 'ok': {
          if (!props.value.includes(artifact.value.id)) {
            props.onChange([...props.value, artifact.value.id]);
          }
          break;
        }
        case 'err': {
          break;
        }
      }
    },
    [props],
  );

  // Memoized render function for artifact options
  const renderOption = useCallback(
    (option: Parameters<typeof ArtifactOptionItem>[0]['option'], selected: boolean) => (
      <ArtifactOptionItem option={option} selected={selected} />
    ),
    [],
  );

  // Handle clear all
  const handleClearAll = useCallback(() => {
    props.onChange([]);
  }, [props]);

  return (
    <div className="space-y-4">
      <SelectedArtifactsList
        artifacts={props.value}
        onRemove={removeArtifact}
        onClearAll={handleClearAll}
      />

      {props.value.length < limit && (
        <AsyncCombobox
          value={currentSelection}
          onChange={addArtifact}
          fetchIds={fetchArtifactIds}
          getOptions={getArtifactOptions}
          placeholder={t('artifact.searchPlaceholder')}
          helperText={t('artifact.helperText')}
          renderOption={renderOption}
          debounceMs={300}
          pageSize={20}
          actionButton={
            <ArtifactUploadComboboxActionButton
              onUploadComplete={handleUploadComplete}
              variant="default"
            />
          }
        />
      )}
    </div>
  );
}
