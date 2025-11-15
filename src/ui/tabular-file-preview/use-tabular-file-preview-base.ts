import * as React from 'react';
import { LRUCache } from 'lru-cache';
import type { FileType, TabularFilePreviewResult } from './types';
import { useI18n } from '../../i18n/use-i18n';

interface UseTabularFilePreviewBaseParams {
  file: File;
  parser: (file: File) => Promise<Record<string, unknown>[]>;
  fileType: FileType;
}

interface CachedResult {
  data: Record<string, unknown>[] | null;
  error: string | null;
}

const parseCache = new LRUCache<string, CachedResult>({
  max: 50,
  ttl: 1000 * 60 * 60,
});

function getFileCacheKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export const useTabularFilePreviewBase = ({
  file,
  parser,
  fileType,
}: UseTabularFilePreviewBaseParams): TabularFilePreviewResult => {
  const { t } = useI18n();
  const cacheKey = React.useMemo(() => getFileCacheKey(file), [file]);

  const initialCached = React.useMemo(() => parseCache.get(cacheKey), [cacheKey]);

  const [data, setData] = React.useState<Record<string, unknown>[] | null>(
    initialCached?.data ?? null,
  );
  const [error, setError] = React.useState<string | null>(initialCached?.error ?? null);
  const [isLoading, setIsLoading] = React.useState(!initialCached);

  React.useEffect(() => {
    const cached = parseCache.get(cacheKey);
    if (cached) {
      setData(cached.data);
      setError(cached.error);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    async function parseFile() {
      try {
        setIsLoading(true);
        setError(null);

        const parsedData = await parser(file);
        if (!isCancelled) {
          const result: CachedResult = { data: parsedData, error: null };
          parseCache.set(cacheKey, result);
          setData(parsedData);
        }
      } catch (err) {
        if (!isCancelled) {
          const errorMessage =
            err instanceof Error ? err.message : t('tabularFilePreview.failedToParse');
          const result: CachedResult = {
            data: [],
            error: errorMessage,
          };
          parseCache.set(cacheKey, result);
          setError(errorMessage);
          setData(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    parseFile();

    return () => {
      isCancelled = true;
    };
  }, [file, parser, cacheKey, t]);

  return { data, error, isLoading, fileType };
};
