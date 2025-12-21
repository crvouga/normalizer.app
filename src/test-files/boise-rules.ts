import { getTestFilePath } from './test-files';

export const BOISE_RULES_FILE_NAME = 'boise-rules.csv';
export const BOISE_RULES_FILE_PATH = getTestFilePath(BOISE_RULES_FILE_NAME);

/**
 * Read just the header line from the CSV file without loading the entire file.
 * This is much more efficient for large files.
 */
export function getHeadersOnly(): string[] {
  // Read only the first line
  const fs = require('fs');
  const fd = fs.openSync(BOISE_RULES_FILE_PATH, 'r');
  try {
    const buffer = Buffer.alloc(10000); // Allocate buffer for first line (should be plenty)
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    const content = buffer.toString('utf-8', 0, bytesRead);
    const firstLineEnd = content.indexOf('\n');
    const headerLine = firstLineEnd > 0 ? content.substring(0, firstLineEnd) : content;
    return headerLine.split(',').map((h) => h.trim());
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Get the expected row count by counting newlines without loading entire file into memory.
 * This is much more efficient for large files.
 */
export function getExpectedRowCountFast(): number {
  const fs = require('fs');
  const fd = fs.openSync(BOISE_RULES_FILE_PATH, 'r');
  try {
    let lineCount = 0;
    const bufferSize = 64 * 1024; // 64KB buffer
    const buffer = Buffer.alloc(bufferSize);
    let leftOver = '';

    while (true) {
      const bytesRead = fs.readSync(fd, buffer, 0, bufferSize, null);
      if (bytesRead === 0) break;

      const chunk = leftOver + buffer.toString('utf-8', 0, bytesRead);
      const lines = chunk.split('\n');

      // Keep the last partial line for next iteration
      leftOver = lines[lines.length - 1] || '';

      // Count complete lines (all but the last one)
      lineCount += lines.length - 1;
    }

    // If there's leftover content, it's the last line
    if (leftOver.trim().length > 0) {
      lineCount += 1;
    }

    // Subtract 1 for header line
    return Math.max(0, lineCount - 1);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Default table name for importing boise-rules.csv into PostgreSQL
 */
export const BOISE_RULES_TABLE_NAME = 'boise_rules';
