import * as React from 'react';
import type {
  AsyncComboboxFetchIdsResult,
  AsyncComboboxFetchOptions,
} from '~/src/ui/combobox/async-combobox';
import type { ComboboxOption } from '~/src/ui/combobox/combobox';
import { useI18n } from '../../i18n/use-i18n';
import { trpcClient } from '../../shared/trpc-client';
import { useEntityStore, useEntityStoreSelector } from '../../store/entity-store';
import { Artifact } from '../artifact';
import { ArtifactId } from '../artifact-id';

/**
 * Hook for fetching artifacts with pagination and search.
 * Uses entity store for caching and the artifact router for data fetching.
 *
 * Separates concerns:
 * - fetchArtifactIds: Fetches from API, stores in entity store, returns IDs
 * - getArtifactOptions: Reads from entity store and hydrates IDs into options
 */
export function useArtifactsLoader() {
  const artifactsById = useEntityStoreSelector((state) => state.entities.artifacts.byId);
  const entityStore = useEntityStore();
  const { t } = useI18n();

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
      if (signal?.aborted) {
        const abortError = new Error('Request aborted');
        abortError.name = 'AbortError';
        throw abortError;
      }

      const rawArtifacts = await trpcClient.artifact.listByUser.mutate();

      if (signal?.aborted) {
        const abortError = new Error('Request aborted');
        abortError.name = 'AbortError';
        throw abortError;
      }

      const allArtifacts: Artifact[] = rawArtifacts.flatMap((artifact) => {
        const parsed = Artifact.schema.safeParse(artifact);
        return parsed.success ? [parsed.data] : [];
      });

      entityStore.addManyEntities('artifacts', allArtifacts);

      const filtered = allArtifacts.filter(
        (artifact) =>
          artifact.filename.toLowerCase().includes(query.toLowerCase()) ||
          artifact.file_type.toLowerCase().includes(query.toLowerCase()),
      );

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
      return ids.flatMap((id) => {
        const artifact = artifactsById[id];
        if (!artifact) return [];
        return [
          {
            value: ArtifactId.schema.parse(artifact.id),
            label: t('artifact.displayName', { name: artifact.name || artifact.filename }),
            metadata: { type: artifact.file_type, size: artifact.size },
          },
        ];
      });
    },
    [artifactsById, t],
  );

  return { fetchArtifactIds, getArtifactOptions };
}
