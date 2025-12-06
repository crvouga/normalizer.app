import type { Logger } from '../lib/logger';
import type { ObjectStore } from '../lib/object-store/object-store';
import { FilesystemObjectStore } from '../lib/object-store/object-store-fs';
import { mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Creates a FilesystemObjectStore instance.
 * @param basePath Optional base path for storing files. If not provided, uses a temporary directory.
 * @param serverBaseUrl Base URL for generating presigned URLs (required for presign functionality).
 * @param logger Logger instance.
 */
export async function createFilesystemObjectStore({
  basePath,
  serverBaseUrl,
  logger,
}: {
  basePath?: string;
  serverBaseUrl: string;
  logger: Logger;
}): Promise<ObjectStore> {
  let resolvedBasePath = basePath;

  // If no basePath provided, create a temporary directory
  if (!resolvedBasePath) {
    const prefix = join(tmpdir(), 'object-store-');
    resolvedBasePath = await mkdtemp(prefix);
    logger.debug('Created temporary directory for filesystem object store', {
      basePath: resolvedBasePath,
    });
  }

  logger.info('Initializing filesystem object store...', {
    basePath: resolvedBasePath,
    serverBaseUrl,
  });

  try {
    const objectStore = new FilesystemObjectStore({
      basePath: resolvedBasePath,
      serverBaseUrl,
      logger,
    });

    logger.info('Successfully initialized filesystem object store', {
      basePath: resolvedBasePath,
      serverBaseUrl,
    });

    return objectStore;
  } catch (error) {
    logger.error('Failed to initialize filesystem object store', {
      error,
      basePath: resolvedBasePath,
      serverBaseUrl,
    });
    throw error instanceof Error
      ? error
      : new Error('Failed to initialize filesystem object store');
  }
}
