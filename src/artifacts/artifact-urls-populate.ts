import type { ObjectStore } from '../lib/object-store/object-store';
import { isOk } from '../lib/result';
import type { Artifact } from './artifact-type';

/**
 * Populates the S3 signed upload and download URLs for a list of artifacts,
 * and sets their expiration timestamps, but only if missing, expired, or if the base URL doesn't match the s3 endpoint.
 *
 * @param artifacts - Array of Artifact objects.
 * @param objectStore - Object store for presigning URLs.
 * @returns Object containing artifacts with updated URLs and a Set of IDs that were modified.
 */
export async function populateArtifactUrls(params: {
  artifacts: Artifact[];
  objectStore: ObjectStore;
}): Promise<{ artifacts: Artifact[]; updated: Set<string> }> {
  const { artifacts, objectStore } = params;

  const now = new Date();

  const updated = new Set<string>();

  const endpointInfoResult = await objectStore.getEndpointInfo();

  if (!isOk(endpointInfoResult)) {
    return { artifacts, updated };
  }

  const { baseUrl, useHTTPS } = endpointInfoResult.value;

  const updatedArtifacts = await Promise.all(
    artifacts.map((artifact) =>
      updateArtifactUrls({ artifact, objectStore, baseUrl, useHTTPS, now, updated }),
    ),
  );

  return { artifacts: updatedArtifacts, updated };
}

const URL_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Calculates the expiration date from a timestamp and expiration duration.
 */
function getExpiresAt(now: Date): Date {
  return new Date(now.getTime() + URL_EXPIRES_IN_SECONDS * 1000);
}

/**
 * Updates URLs for a single artifact if needed.
 */
async function updateArtifactUrls(params: {
  artifact: Artifact;
  objectStore: ObjectStore;
  baseUrl: string;
  useHTTPS: boolean;
  now: Date;
  updated: Set<string>;
}): Promise<Artifact> {
  const { artifact, objectStore, baseUrl, now, useHTTPS, updated } = params;
  const expiresAt = getExpiresAt(now);

  const upload_url = artifact.upload_url ?? null;
  const download_url = artifact.download_url ?? null;
  const upload_url_expires_at = artifact.upload_url_expires_at ?? null;
  const download_url_expires_at = artifact.download_url_expires_at ?? null;

  const uploadNeedsUpdate = urlNeedsUpdate({
    url: upload_url,
    expiresAt: upload_url_expires_at,
    baseUrl,
    now,
  });

  const downloadNeedsUpdate = urlNeedsUpdate({
    url: download_url,
    expiresAt: download_url_expires_at,
    baseUrl,
    now,
  });

  const newUploadUrl = uploadNeedsUpdate
    ? await presignUrl({
        objectStore,
        bucket: artifact.s3_bucket,
        key: artifact.s3_key,
        method: 'PUT',
        expiresIn: URL_EXPIRES_IN_SECONDS,
        useHTTPS,
      })
    : upload_url;

  const newDownloadUrl = downloadNeedsUpdate
    ? await presignUrl({
        objectStore,
        bucket: artifact.s3_bucket,
        key: artifact.s3_key,
        method: 'GET',
        expiresIn: URL_EXPIRES_IN_SECONDS,
        useHTTPS,
      })
    : download_url;

  if (uploadNeedsUpdate || downloadNeedsUpdate) {
    updated.add(String(artifact.id));
  }

  return {
    ...artifact,
    upload_url: newUploadUrl,
    upload_url_expires_at: uploadNeedsUpdate ? expiresAt : upload_url_expires_at,
    download_url: newDownloadUrl,
    download_url_expires_at: downloadNeedsUpdate ? expiresAt : download_url_expires_at,
  };
}

/**
 * Extracts the base URL (protocol + host) from a URL string.
 */
function extractUrlBase(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/**
 * Ensures a URL uses HTTPS if the endpoint requires it.
 */
function ensureHTTPS(url: string | undefined, useHTTPS: boolean): string | undefined {
  if (!url || !useHTTPS) return url;
  return url.startsWith('http://') ? url.replace('http://', 'https://') : url;
}

/**
 * Checks if a URL needs to be refreshed based on expiration and base URL match.
 */
function urlNeedsUpdate(params: {
  url: string | null;
  expiresAt: Date | null;
  baseUrl: string;
  now: Date;
}): boolean {
  const { url, expiresAt, baseUrl, now } = params;
  if (!url) return true;
  if (!expiresAt) return true;
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  if (expiresAt.getTime() - now.getTime() < FIVE_MINUTES_MS) return true;
  if (extractUrlBase(url) !== baseUrl) return true;
  return false;
}

/**
 * Presigns a URL and returns the updated URL with HTTPS if needed.
 */
async function presignUrl(params: {
  objectStore: ObjectStore;
  bucket: string;
  key: string;
  method: 'GET' | 'PUT';
  expiresIn: number;
  useHTTPS: boolean;
}): Promise<string | undefined> {
  const { objectStore, bucket, key, method, expiresIn, useHTTPS } = params;
  const res = await objectStore.presign({ bucket, key, method, expiresIn });
  if (isOk(res)) {
    return ensureHTTPS(res.value, useHTTPS);
  }
  return undefined;
}
