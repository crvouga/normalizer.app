import * as React from 'react';
import type {
  AsyncComboboxFetchOptions,
  AsyncComboboxFetchResult,
} from '~/src/ui/combobox/async-combobox';
import type { ArtifactId } from '../artifact-id';

// Example artifact data structure
export interface Artifact {
  id: ArtifactId;
  name: string;
  type: string;
}

/**
 * Hook for fetching artifacts with pagination and search.
 * TODO: Replace mock data with actual API call.
 */
export function useFetchArtifacts() {
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

  return { fetchArtifacts };
}
