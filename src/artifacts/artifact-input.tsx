import * as React from 'react';
import {
  AsyncCombobox,
  type AsyncComboboxFetchOptions,
  type AsyncComboboxFetchResult,
  type AsyncComboboxOption,
} from '~/src/ui/combobox/async-combobox';
import { IconCheck } from '~/src/ui/icons';
import { Typography } from '~/src/ui/typography';
import type { ArtifactId } from './artifact-id';
import { useI18n } from '../i18n/use-i18n';

export type ArtifactInputProps = {
  value: ArtifactId[];
  onChange: (value: ArtifactId[]) => void;
};

// Example artifact data structure
interface Artifact {
  id: ArtifactId;
  name: string;
  type: string;
}

export const ArtifactInput = (props: ArtifactInputProps) => {
  const { t } = useI18n();
  const [selectedArtifact, setSelectedArtifact] = React.useState<ArtifactId | null>(null);

  // Example fetch function that simulates an API call
  const fetchArtifacts = React.useCallback(
    async ({
      query,
      page,
      pageSize,
      signal,
    }: AsyncComboboxFetchOptions): Promise<AsyncComboboxFetchResult<ArtifactId>> => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Check if request was aborted
      if (signal?.aborted) {
        const abortError = new Error('Request aborted');
        abortError.name = 'AbortError';
        throw abortError;
      }

      // Mock data - replace with actual API call
      const mockArtifacts: Artifact[] = Array.from({ length: 100 }, (_, i) => ({
        id: `artifact-${i + 1}` as ArtifactId,
        name: `Artifact ${i + 1}`,
        type: i % 3 === 0 ? 'CSV' : i % 3 === 1 ? 'JSON' : 'Excel',
      }));

      // Filter based on query
      const filtered = mockArtifacts.filter(
        (artifact) =>
          artifact.name.toLowerCase().includes(query.toLowerCase()) ||
          artifact.type.toLowerCase().includes(query.toLowerCase()),
      );

      // Paginate
      const start = page * pageSize;
      const end = start + pageSize;
      const items = filtered.slice(start, end);

      return {
        items: items.map((artifact) => ({
          value: artifact.id,
          label: artifact.name,
          metadata: { type: artifact.type },
        })),
        hasMore: end < filtered.length,
        total: filtered.length,
      };
    },
    [],
  );

  const handleChange = (artifactId: ArtifactId | null) => {
    setSelectedArtifact(artifactId);
    if (artifactId) {
      props.onChange([...props.value, artifactId]);
    }
  };

  // Custom render for options showing artifact type
  const renderOption = (option: AsyncComboboxOption<ArtifactId>, selected: boolean) => (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <Typography weight={selected ? 'semibold' : 'normal'}>{option.label}</Typography>
        {option.metadata?.type && (
          <Typography variant="xs" color="muted">
            {option.metadata.type as string}
          </Typography>
        )}
      </div>
      {selected && <IconCheck className="text-blue-600" />}
    </div>
  );

  return (
    <div className="space-y-4">
      <AsyncCombobox
        value={selectedArtifact}
        onChange={handleChange}
        fetchOptions={fetchArtifacts}
        placeholder={t('artifact.searchPlaceholder')}
        label={t('artifact.label')}
        helperText={t('artifact.helperText')}
        renderOption={renderOption}
        debounceMs={300}
        pageSize={20}
      />

      {/* Display selected artifacts */}
      {props.value.length > 0 && (
        <div className="space-y-2">
          <Typography variant="sm" weight="medium" color="primary">
            {t('artifact.selectedArtifacts')}
          </Typography>
          <div className="flex flex-wrap gap-2">
            {props.value.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 dark:bg-blue-900"
              >
                <Typography variant="sm" className="text-blue-800 dark:text-blue-200">
                  {id}
                </Typography>
                <button
                  onClick={() => props.onChange(props.value.filter((v) => v !== id))}
                  className="text-blue-800 hover:text-blue-900 dark:text-blue-200 dark:hover:text-blue-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
