import * as React from 'react';
import type {
  AsyncComboboxFetchOptions,
  AsyncComboboxFetchResult,
} from '~/src/ui/combobox/async-combobox';
import type { Artifact } from '../artifact';
import type { ArtifactId } from '../artifact-id';
import { trpcClient } from '../../trpc-client';

/**
 * Hook for fetching artifacts with pagination and search.
 * Uses the artifact router to fetch real data from the backend.
 */
export function useFetchArtifacts() {
  const fetchArtifacts = React.useCallback(
    async ({
      query,
      page,
      pageSize,
      signal,
    }: AsyncComboboxFetchOptions): Promise<AsyncComboboxFetchResult<ArtifactId>> => {
      // Check if request was aborted
      if (signal?.aborted) {
        const abortError = new Error('Request aborted');
        abortError.name = 'AbortError';
        throw abortError;
      }

      // Fetch artifacts from the API
      const artifacts: Artifact[] = await trpcClient.artifact.list.query();

      // Check if request was aborted after fetch
      if (signal?.aborted) {
        const abortError = new Error('Request aborted');
        abortError.name = 'AbortError';
        throw abortError;
      }

      // Filter based on query
      const filtered = artifacts.filter(
        (artifact) =>
          artifact.filename.toLowerCase().includes(query.toLowerCase()) ||
          artifact.file_type.toLowerCase().includes(query.toLowerCase()),
      );

      // Paginate
      const start = page * pageSize;
      const end = start + pageSize;
      const items = filtered.slice(start, end);

      return {
        items: items.map((artifact) => ({
          value: artifact.id as ArtifactId,
          label: artifact.filename,
          metadata: { type: artifact.file_type, size: artifact.size },
        })),
        hasMore: end < filtered.length,
        total: filtered.length,
      };
    },
    [],
  );

  return { fetchArtifacts };
}
