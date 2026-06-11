import { isLoopbackHost } from './loopback-host';

/**
 * Rewrites presigned URLs for browser use when they target the app-server proxy
 * or loopback MinIO. Remote endpoints (e.g. Backblaze B2) are returned unchanged.
 */
export function normalizePresignedUrlForBrowser(presignedUrl: string): string {
  if (typeof window === 'undefined') {
    return presignedUrl;
  }

  const url = new URL(presignedUrl);
  const isProxied = url.pathname.startsWith('/api/objects/');

  if (!isProxied && !isLoopbackHost(url.hostname)) {
    return presignedUrl;
  }

  url.protocol = window.location.protocol;
  url.host = window.location.host;
  return url.toString();
}
