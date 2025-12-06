import { join } from 'path';

/**
 * Returns the absolute path to a test file in the test-files directory.
 *
 * @param {string} fileName - The name of the test file.
 * @returns {string} The absolute path to the test file.
 */
export function getTestFilePath(fileName: string): string {
  return join('src', 'test-files', fileName);
}
