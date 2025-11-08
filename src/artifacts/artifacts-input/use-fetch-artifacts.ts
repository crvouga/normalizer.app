import * as React from 'react';
import type {
  AsyncComboboxFetchOptions,
  AsyncComboboxFetchIdsResult,
} from '~/src/ui/combobox/async-combobox';
import type { ComboboxOption } from '~/src/ui/combobox/combobox';
import type { Artifact } from '../artifact';
import type { ArtifactId } from '../artifact-id';
import { trpcClient } from '../../trpc-client';
import { useEntityStoreSelector, useEntityStore } from '../../store/entity-store';

/**
 * Hook for fetching artifacts with pagination and search.
 * Uses entity store for caching and the artifact router for data fetching.
 *
 * Separates concerns:
 * - fetchArtifactIds: Fetches from API, stores in entity store, returns IDs
 * - getArtifactOptions: Reads from entity store and hydrates IDs into options
 */
export function useFetchArtifacts() {
  const artifactsById = useEntityStoreSelector((state) => state.entities.artifacts.byId);
  const entityStore = useEntityStore();

  /**
   * Fetches artifacts from the API, stores them in the entity store,
   * and returns only the IDs for the requested page.
   */
  const fetchArtifactIds = React.useCallback(
    async ({
      query,
      page,
      pageSize,
      signal,
    }: AsyncComboboxFetchOptions): Promise<AsyncComboboxFetchIdsResult<ArtifactId>> => {
      // Check if request was aborted
      if (signal?.aborted) {
        const abortError = new Error('Request aborted');
        abortError.name = 'AbortError';
        throw abortError;
      }

      // Fetch artifacts from the API
      const allArtifacts: Artifact[] = await trpcClient.artifact.list.query();

      // Check if request was aborted after fetch
      if (signal?.aborted) {
        const abortError = new Error('Request aborted');
        abortError.name = 'AbortError';
        throw abortError;
      }

      // Store all artifacts in entity store
      entityStore.addManyEntities('artifacts', allArtifacts);

      // Filter based on query
      const filtered = allArtifacts.filter(
        (artifact) =>
          artifact.filename.toLowerCase().includes(query.toLowerCase()) ||
          artifact.file_type.toLowerCase().includes(query.toLowerCase()),
      );

      // Paginate
      const start = page * pageSize;
      const end = start + pageSize;
      const items = filtered.slice(start, end);

      return {
        ids: items.map((artifact) => artifact.id as ArtifactId),
        hasMore: end < filtered.length,
        total: filtered.length,
      };
    },
    [entityStore],
  );

  /**
   * Reads artifacts from the entity store and hydrates IDs into ComboboxOptions.
   * This function is synchronous and relies on data already being in the store.
   */
  const getArtifactOptions = React.useCallback(
    (ids: ArtifactId[]): ComboboxOption<ArtifactId>[] => {
      return ids
        .map((id) => artifactsById[id])
        .filter((artifact): artifact is Artifact => artifact !== undefined)
        .map((artifact) => ({
          value: artifact.id as ArtifactId,
          label: artifact.filename,
          metadata: { type: artifact.file_type, size: artifact.size },
        }));
    },
    [artifactsById],
  );

  return { fetchArtifactIds, getArtifactOptions };
}
