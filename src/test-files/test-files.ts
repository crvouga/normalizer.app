import { join } from 'path';

export const TEST_FILES_DIR = join('synced', 'test-files');

/**
 * Returns the absolute path to a test file in the test-files directory.
 *
 * @param {string} fileName - The name of the test file.
 * @returns {string} The absolute path to the test file.
 */
export function getTestFilePath(fileName: string): string {
  return join(TEST_FILES_DIR, fileName);
}
