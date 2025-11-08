import * as React from 'react';
import type {
  AsyncComboboxFetchOptions,
  AsyncComboboxFetchResult,
} from '~/src/ui/combobox/async-combobox';
import type { Artifact } from '../artifact';
import type { ArtifactId } from '../artifact-id';
import { trpcClient } from '../../trpc-client';
import { useEntityStore, dispatch } from '../../store/entity-store';
import { generateSearchHash } from './search-hash';

/**
 * Hook for fetching artifacts with pagination and search.
 * Uses entity store for caching and the artifact router for data fetching.
 */
export function useFetchArtifacts() {
  const searchResults = useEntityStore((state) => state.indexes.searchResults);
  const artifactsById = useEntityStore((state) => state.entities.artifacts.byId);

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

      // Generate search hash for caching
      const searchHash = generateSearchHash({ query, page, pageSize });

      // Check if we have cached results
      const cachedIds = searchResults[searchHash];
      if (cachedIds) {
        // Materialize artifacts from entity store
        const artifacts = cachedIds
          .map((id) => artifactsById[id as ArtifactId])
          .filter((artifact): artifact is Artifact => artifact !== undefined);

        return {
          items: artifacts.map((artifact) => ({
            value: artifact.id as ArtifactId,
            label: artifact.filename,
            metadata: { type: artifact.file_type, size: artifact.size },
          })),
          hasMore: false, // For cached results, we return full page
          total: artifacts.length,
        };
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
      dispatch({
        type: 'entity/ADD_MANY',
        entityType: 'artifacts',
        entities: allArtifacts,
      });

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

      // Cache the search results
      dispatch({
        type: 'index/SET_SEARCH_RESULTS',
        searchKey: searchHash,
        ids: items.map((artifact) => artifact.id as string),
      });

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
    [searchResults, artifactsById],
  );

  return { fetchArtifacts };
}
