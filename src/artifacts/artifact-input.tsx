import * as React from 'react';
import type { ArtifactId } from './artifact-id';
import {
  Combobox,
  type ComboboxFetchOptions,
  type ComboboxFetchResult,
  type ComboboxOption,
} from '~/src/ui/combobox/combobox';

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
  const [selectedArtifact, setSelectedArtifact] = React.useState<ArtifactId | null>(null);

  // Example fetch function that simulates an API call
  const fetchArtifacts = React.useCallback(
    async ({
      query,
      page,
      pageSize,
      signal,
    }: ComboboxFetchOptions): Promise<ComboboxFetchResult<ArtifactId>> => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Check if request was aborted
      if (signal?.aborted) {
        throw new Error('Request aborted');
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
  const renderOption = (option: ComboboxOption<ArtifactId>, selected: boolean) => (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className={selected ? 'font-semibold' : ''}>{option.label}</span>
        {option.metadata?.type && (
          <span className="text-xs text-gray-500">{option.metadata.type as string}</span>
        )}
      </div>
      {selected && (
        <svg
          className="h-4 w-4 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <Combobox
        value={selectedArtifact}
        onChange={handleChange}
        fetchOptions={fetchArtifacts}
        placeholder="Search artifacts..."
        label="Select Artifact"
        helperText="Search by name or type"
        renderOption={renderOption}
        debounceMs={300}
        pageSize={20}
      />

      {/* Display selected artifacts */}
      {props.value.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Selected Artifacts:</p>
          <div className="flex flex-wrap gap-2">
            {props.value.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
              >
                {id}
                <button
                  onClick={() => props.onChange(props.value.filter((v) => v !== id))}
                  className="hover:text-blue-900"
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
