import type { S3Client } from 'bun';
import type { Artifact } from './artifact-type';

/**
 * Populates the S3 signed upload and download URLs for a list of artifacts,
 * and sets their expiration timestamps, but only if missing, expired, or if the base URL doesn't match the s3 endpoint.
 *
 * @param artifacts - Array of Artifact objects.
 * @param s3 - S3 client for presigning URLs.
 * @param s3Endpoint - S3 endpoint URL (required, used to determine if HTTPS should be enforced and to validate base URLs).
 * @returns Object containing artifacts with updated URLs and a Set of IDs that were modified.
 */
export async function refreshArtifactUrls(
  artifacts: Artifact[],
  s3: S3Client,
  s3Endpoint: string,
): Promise<{ artifacts: Artifact[]; updated: Set<string> }> {
  const expiresIn = 60 * 60 * 24 * 7; // 7 days
  const now = Date.now();
  const expiresAt = new Date(now + expiresIn * 1000);
  const updated = new Set<string>();

  // Determine if we should use HTTPS based on the endpoint
  const useHTTPS = s3Endpoint.startsWith('https://');

  /**
   * Extracts the base URL (protocol + host + port) from a URL string.
   */
  function getBaseUrl(urlString: string): string | null {
    try {
      const url = new URL(urlString);
      return `${url.protocol}//${url.host}`;
    } catch {
      return null;
    }
  }

  // Get the expected base URL from the s3 endpoint
  const expectedBaseUrl = getBaseUrl(s3Endpoint);

  /**
   * Checks if the URL's base URL matches the expected s3 endpoint base URL.
   */
  function hasMatchingBaseUrl(url: string | null | undefined): boolean {
    if (!url || !expectedBaseUrl) return false;
    const urlBase = getBaseUrl(url);
    return urlBase === expectedBaseUrl;
  }

  function isMissingOrExpired(url: string | null | undefined, expiresAt: Date | null | undefined) {
    if (!url || !expiresAt) return true;
    return new Date(expiresAt).getTime() < now;
  }

  /**
   * Ensures the URL uses HTTPS when the S3 endpoint is configured with HTTPS.
   * This fixes mixed content errors when the page is served over HTTPS.
   */
  function ensureHTTPS(url: string | undefined): string | undefined {
    if (!url || !useHTTPS) return url;
    if (url.startsWith('http://')) {
      return url.replace('http://', 'https://');
    }
    return url;
  }

  const updatedArtifacts = await Promise.all(
    artifacts.map(async (artifact) => {
      let upload_url = artifact.upload_url ?? null;
      let download_url = artifact.download_url ?? null;
      let upload_url_expires_at = artifact.upload_url_expires_at ?? null;
      let download_url_expires_at = artifact.download_url_expires_at ?? null;

      const key = artifact.s3_key;

      // Check if URLs need to be regenerated due to expiration, missing, or base URL mismatch
      const shouldUpdateUpload =
        isMissingOrExpired(upload_url, upload_url_expires_at) || !hasMatchingBaseUrl(upload_url);
      const shouldUpdateDownload =
        isMissingOrExpired(download_url, download_url_expires_at) ||
        !hasMatchingBaseUrl(download_url);

      let newUploadUrl: string | undefined;
      let newDownloadUrl: string | undefined;

      if (shouldUpdateUpload) {
        newUploadUrl = ensureHTTPS(s3.presign(key, { method: 'PUT', expiresIn }));
        upload_url_expires_at = expiresAt;
      }
      if (shouldUpdateDownload) {
        newDownloadUrl = ensureHTTPS(s3.presign(key, { method: 'GET', expiresIn }));
        download_url_expires_at = expiresAt;
      }

      // Track if this artifact was modified
      if (shouldUpdateUpload || shouldUpdateDownload) {
        updated.add(String(artifact.id));
      }

      return {
        ...artifact,
        upload_url: shouldUpdateUpload ? newUploadUrl : upload_url,
        upload_url_expires_at,
        download_url: shouldUpdateDownload ? newDownloadUrl : download_url,
        download_url_expires_at,
      };
    }),
  );

  return { artifacts: updatedArtifacts, updated };
}
