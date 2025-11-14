import { useEffect, useState } from 'react';

export interface UseFileLoaderParams {
  downloadUrl: string;
  fileName: string;
  contentType?: string;
  enabled: boolean;
}

export interface UseFileLoaderResult {
  loadedFile: File | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * A reusable hook for lazy-loading files from URLs.
 *
 * Handles:
 * - Lazy loading when enabled condition is met
 * - Protocol matching to avoid mixed content errors
 * - Loading state management
 * - Error handling
 * - Automatic cleanup on unmount
 *
 * @example
 * ```tsx
 * const { loadedFile, isLoading, error } = useFileLoader({
 *   downloadUrl: tabularFile.downloadUrl,
 *   fileName: tabularFile.name,
 *   contentType: tabularFile.contentType,
 *   enabled: isPreviewVisible,
 * });
 * ```
 */
export function useFileLoader({
  downloadUrl,
  fileName,
  contentType = 'application/octet-stream',
  enabled,
}: UseFileLoaderParams): UseFileLoaderResult {
  const [loadedFile, setLoadedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldLoadFile(enabled, loadedFile)) {
      return;
    }

    let isCancelled = false;

    function cancel() {
      isCancelled = true;
    }

    async function doLoad() {
      setIsLoading(true);
      setError(null);

      try {
        const url = normalizeProtocol(downloadUrl);
        const file = await fetchFile(url, fileName, contentType);
        if (!isCancelled) {
          setLoadedFile(file);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(parseError(err));
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    doLoad();

    return cancel;
  }, [enabled, downloadUrl, fileName, contentType, loadedFile]);

  return {
    loadedFile,
    isLoading,
    error,
  };
}

// --- Helper functions ---

function shouldLoadFile(enabled: boolean, loadedFile: File | null): boolean {
  return enabled && !loadedFile;
}

/**
 * If the URL is remote and the protocol does not match the window's,
 * swap to the app's protocol to avoid mixed content errors.
 */
function normalizeProtocol(url: string): string {
  if (
    typeof window !== 'undefined' &&
    url.startsWith('http') &&
    window.location.protocol &&
    !url.startsWith(window.location.protocol)
  ) {
    return url.replace(/^https?:/, window.location.protocol);
  }
  return url;
}

/**
 * Fetches the file as a Blob, then creates a File object with the given properties.
 */
async function fetchFile(url: string, fileName: string, contentType: string): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  const blob = await response.blob();
  return new File([blob], fileName, { type: contentType });
}

/**
 * Standardize error parsing.
 */
function parseError(err: unknown): string {
  return err instanceof Error ? err.message : 'Failed to load file';
}
