import { Err, Ok, type Result } from '../result';
import type { ObjectStore } from './object-store';
import type { Logger } from '../logger';

/**
 * Normalizes a prefix by ensuring it doesn't have a leading slash but has a trailing slash if non-empty.
 * Examples:
 * - "" -> ""
 * - "dir" -> "dir/"
 * - "dir/" -> "dir/"
 * - "/dir" -> "dir/"
 */
function normalizePrefix(prefix: string | undefined): string {
  if (!prefix) {
    return '';
  }
  // Remove leading slash if present
  let normalized = prefix.startsWith('/') ? prefix.slice(1) : prefix;
  // Add trailing slash if not empty and doesn't already have one
  if (normalized && !normalized.endsWith('/')) {
    normalized += '/';
  }
  return normalized;
}

/**
 * Removes the source prefix from a key and adds the destination prefix.
 * Examples:
 * - key: "dir1/file.txt", sourcePrefix: "dir1/", destPrefix: "dir2/" -> "dir2/file.txt"
 * - key: "file.txt", sourcePrefix: "", destPrefix: "dir/" -> "dir/file.txt"
 * - key: "dir1/sub/file.txt", sourcePrefix: "dir1/", destPrefix: "" -> "sub/file.txt"
 */
function remapKey(key: string, sourcePrefix: string, destPrefix: string): string {
  // Remove source prefix if present
  let remappedKey = key;
  if (sourcePrefix && key.startsWith(sourcePrefix)) {
    remappedKey = key.slice(sourcePrefix.length);
  }

  // Add destination prefix
  if (destPrefix) {
    remappedKey = destPrefix + remappedKey;
  }

  return remappedKey;
}

/**
 * Copy an entire directory from one ObjectStore to another.
 * Supports prefix remapping to copy subsets or relocate directories.
 *
 * @param params Configuration object
 * @param params.source Source ObjectStore configuration
 * @param params.source.objectStore The source ObjectStore instance
 * @param params.source.bucket Source bucket name
 * @param params.source.prefix Optional prefix to filter source objects (e.g., "dir1/")
 * @param params.destination Destination ObjectStore configuration
 * @param params.destination.objectStore The destination ObjectStore instance
 * @param params.destination.bucket Destination bucket name
 * @param params.destination.prefix Optional prefix to prepend to destination keys (e.g., "dir2/")
 * @param params.logger Logger for logging progress and errors (required)
 * @returns Result containing the count of copied objects, or an error message
 *
 * @example
 * // Copy entire bucket
 * await copyObjectStoreDirectory({
 *   source: { objectStore: store1, bucket: 'bucket1' },
 *   destination: { objectStore: store2, bucket: 'bucket2' },
 *   logger,
 * });
 *
 * @example
 * // Copy with prefix remapping
 * await copyObjectStoreDirectory({
 *   source: { objectStore: store1, bucket: 'bucket1', prefix: 'dir1/' },
 *   destination: { objectStore: store2, bucket: 'bucket2', prefix: 'dir2/' },
 *   logger,
 * });
 */
export async function copyObjectStoreDirectory(params: {
  source: {
    objectStore: ObjectStore;
    bucket: string;
    prefix?: string;
  };
  destination: {
    objectStore: ObjectStore;
    bucket: string;
    prefix?: string;
  };
  logger: Logger; // Logger is now required
}): Promise<Result<{ copiedCount: number }, string>> {
  const { source, destination, logger } = params;

  // Normalize prefixes
  const sourcePrefix = normalizePrefix(source.prefix);
  const destPrefix = normalizePrefix(destination.prefix);

  logger.info(
    `Begin copying objects from '${source.bucket}' (prefix: '${sourcePrefix}') to '${destination.bucket}' (prefix: '${destPrefix}')`,
  );

  // Ensure destination bucket exists
  const ensureBucketResult = await destination.objectStore.ensureBucketExists(destination.bucket);
  if (ensureBucketResult.tag !== 'ok') {
    logger.error(`Failed to ensure destination bucket exists: ${ensureBucketResult.error}`, {
      destBucket: destination.bucket,
    });
    return Err(`Failed to ensure destination bucket exists: ${ensureBucketResult.error}`);
  }

  let copiedCount = 0;

  try {
    // List all objects from source
    for await (const obj of source.objectStore.listAllObjects(
      source.bucket,
      sourcePrefix || undefined,
    )) {
      const destKey = remapKey(obj.key, sourcePrefix, destPrefix);

      logger.debug(`Copying object '${obj.key}' to '${destKey}'`);

      // Read from source
      const readResult = await source.objectStore.read({
        bucket: source.bucket,
        key: obj.key,
      });

      if (readResult.tag === 'err') {
        logger.error(`Failed to read object ${obj.key} from source: ${readResult.error}`, {
          key: obj.key,
          error: readResult.error,
        });
        return Err(`Failed to read object ${obj.key} from source: ${readResult.error}`);
      }

      // Write to destination
      const writeResult = await destination.objectStore.write({
        bucket: destination.bucket,
        key: destKey,
        data: readResult.value,
      });

      if (writeResult.tag === 'err') {
        logger.error(`Failed to write object ${destKey} to destination: ${writeResult.error}`, {
          key: destKey,
          error: writeResult.error,
        });
        return Err(`Failed to write object ${destKey} to destination: ${writeResult.error}`);
      }

      copiedCount++;

      if (copiedCount % 100 === 0) {
        logger.info(`Copied ${copiedCount} objects so far...`);
      }
    }
  } catch (error) {
    logger.error(
      `Unexpected error during copy: ${error instanceof Error ? error.message : String(error)}`,
      { error },
    );
    return Err(
      `Unexpected error during copy: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  logger.info(`Completed copying objects. Total copied: ${copiedCount}`);

  return Ok({ copiedCount });
}
