import { createLogger } from '~/src/lib/logger';
import { copyObjectStoreDirectory } from '~/src/lib/object-store/object-store-copy';
import { createFilesystemObjectStore } from '~/src/shared/object-store-fs';
import { createObjectStore } from '~/src/shared/s3';
import { TEST_FILES_DIR } from './test-files';

export async function main(): Promise<void> {
  const logger = createLogger({ noop: false }).child('TestFiles').child('Pull');
  const port = 8080;
  logger.info('Starting pull script...');
  logger.info(`Initializing local object store at: ${TEST_FILES_DIR}`);
  const localObjectStore = await createFilesystemObjectStore({
    basePath: TEST_FILES_DIR,
    serverBaseUrl: `http://localhost:${port}`,
    logger,
  });

  logger.info('Initializing remote object store...');
  const remoteObjectStore = await createObjectStore({
    logger,
  });
  logger.info(`Copying objects from remote to local directory ${TEST_FILES_DIR}...`);
  await copyObjectStoreDirectory({
    source: { objectStore: remoteObjectStore, bucket: 'test-files' },
    destination: { objectStore: localObjectStore, bucket: 'test-files', prefix: TEST_FILES_DIR },
    logger,
  });
  logger.info(`Pull complete. Objects copied to ${TEST_FILES_DIR}`);
}

main().catch((err) => {
  // log any errors
  console.error('Pull script failed:', err);
  process.exitCode = 1;
});
