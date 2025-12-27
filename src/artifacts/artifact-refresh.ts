import type { ObjectStore } from '../lib/object-store/object-store';
import { isOk } from '../lib/result';
import type { Artifact } from './artifact-type';

/**
 * Refreshes all derived data for a list of artifacts, including:
 * - S3 signed upload and download URLs (if missing, expired, or base URL doesn't match)
 * - Artifact sizes (if size is 0)
 *
 * This function is the central place to refresh all computed/derived artifact data
 * that needs to be fetched from the object store.
 *
 * @param artifacts - Array of Artifact objects.
 * @param objectStore - Object store for presigning URLs and querying metadata.
 * @returns Object containing artifacts with updated derived data and a Set of IDs that were modified.
 */
export async function refreshArtifactData(params: {
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

  // First, populate sizes for artifacts that need it
  const artifactsWithSizes = await populateArtifactSizes({
    artifacts,
    objectStore,
    updated,
  });

  // Then, populate URLs
  const updatedArtifacts = await Promise.all(
    artifactsWithSizes.map((artifact) =>
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
        bucket: artifact.object_bucket,
        key: artifact.object_key,
        method: 'PUT',
        expiresIn: URL_EXPIRES_IN_SECONDS,
        useHTTPS,
      })
    : upload_url;

  const newDownloadUrl = downloadNeedsUpdate
    ? await presignUrl({
        objectStore,
        bucket: artifact.object_bucket,
        key: artifact.object_key,
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
 * Populates sizes for artifacts that have size 0 by querying the object store.
 */
async function populateArtifactSizes(params: {
  artifacts: Artifact[];
  objectStore: ObjectStore;
  updated: Set<string>;
}): Promise<Artifact[]> {
  const { artifacts, objectStore, updated } = params;

  // Find artifacts that need size population (size is 0 and object_key is set)
  const artifactsNeedingSize = artifacts.filter(
    (artifact) => artifact.size === 0 && artifact.object_key && artifact.object_bucket,
  );

  if (artifactsNeedingSize.length === 0) {
    return artifacts;
  }

  // Group artifacts by bucket to batch list operations
  const artifactsByBucket = new Map<string, Artifact[]>();
  for (const artifact of artifactsNeedingSize) {
    const bucket = artifact.object_bucket;
    if (!artifactsByBucket.has(bucket)) {
      artifactsByBucket.set(bucket, []);
    }
    artifactsByBucket.get(bucket)!.push(artifact);
  }

  // Create a map of key -> size for efficient lookup
  const sizeMap = new Map<string, number>();

  // For each bucket, list objects and extract sizes
  for (const [bucket, bucketArtifacts] of artifactsByBucket) {
    if (!bucketArtifacts || bucketArtifacts.length === 0) continue;

    // Extract common prefix if all artifacts share one (e.g., normalizer-output/run-id/)
    const keys = bucketArtifacts.map((a) => a.object_key).filter(Boolean) as string[];
    if (keys.length === 0) continue;

    // Try to find a common prefix
    const commonPrefix = findCommonPrefix(keys);

    if (commonPrefix) {
      // List objects with the common prefix for efficiency
      const listResult = await objectStore.listObjects(bucket, {
        prefix: commonPrefix,
        maxKeys: 1000,
      });

      if (isOk(listResult)) {
        for (const obj of listResult.value.objects) {
          sizeMap.set(obj.key, obj.size);
        }
      }
    } else {
      // If no common prefix, we need to list all objects or use a different strategy
      // For now, list without prefix (this might be inefficient for large buckets)
      const listResult = await objectStore.listObjects(bucket, {
        maxKeys: 1000,
      });

      if (isOk(listResult)) {
        for (const obj of listResult.value.objects) {
          sizeMap.set(obj.key, obj.size);
        }
      }
    }
  }

  // Update artifacts with sizes
  return artifacts.map((artifact) => {
    if (artifact.size === 0 && artifact.object_key && sizeMap.has(artifact.object_key)) {
      const size = sizeMap.get(artifact.object_key)!;
      if (size > 0) {
        updated.add(String(artifact.id));
        return { ...artifact, size };
      }
    }
    return artifact;
  });
}

/**
 * Finds the longest common prefix among an array of strings.
 */
function findCommonPrefix(strings: string[]): string | null {
  if (strings.length === 0) return null;
  if (strings.length === 1) {
    // Return the directory part (everything up to the last '/')
    const firstString = strings[0];
    if (!firstString) return null;
    const lastSlash = firstString.lastIndexOf('/');
    return lastSlash >= 0 ? firstString.substring(0, lastSlash + 1) : null;
  }

  // Find the shortest string
  const shortest = strings.reduce((a, b) => (a.length <= b.length ? a : b));

  // Find the longest common prefix
  let prefix = '';
  for (let i = 0; i < shortest.length; i++) {
    const char = shortest[i];
    if (strings.every((str) => str[i] === char)) {
      prefix += char;
    } else {
      break;
    }
  }

  // If we found a prefix, return up to the last '/' to get the directory
  if (prefix.length > 0) {
    const lastSlash = prefix.lastIndexOf('/');
    return lastSlash >= 0 ? prefix.substring(0, lastSlash + 1) : null;
  }

  return null;
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
  const res = await objectStore.presign({ bucket, key, method, expiresIn, useHTTPS });
  if (isOk(res)) {
    return res.value;
  }
  return undefined;
}
