import { readFileSync } from 'fs';
import { z } from 'zod';
import { getTestFilePath } from './test-files';

/**
 * Boise Rules CSV File Module
 *
 * This module provides everything related to the boise-rules.csv file:
 * - Header column definitions
 * - Zod schema for validation
 * - File loading utilities
 * - Type definitions
 */

// ============================================================================
// File Constants
// ============================================================================

export const BOISE_RULES_FILE_NAME = 'boise-rules.csv';
export const BOISE_RULES_FILE_PATH = getTestFilePath(BOISE_RULES_FILE_NAME);

// ============================================================================
// Column Headers
// ============================================================================

/**
 * All column headers in the boise-rules.csv file in order.
 * This CSV contains transfer credit rules between institutions.
 */
export const BOISE_RULES_HEADERS = [
  // Send (Source) Institution Information
  'SendInstitution',
  'SendInstitutionCity',
  'SendInstitutionState',
  'SendInstitutionCountry',
  'SendInstitutionIPEDSID',
  'SendEditionLowYear',
  'SendEditionHighYear',

  // Send Course 1
  'SendCourse1CourseCode',
  'SendCourse1CourseTitle',
  'SendCourse1Units',

  // Send Course 2
  'SendCourse2CourseCode',
  'SendCourse2CourseTitle',
  'SendCourse2Units',

  // Send Course 3
  'SendCourse3CourseCode',
  'SendCourse3CourseTitle',
  'SendCourse3Units',

  // Send Course 4
  'SendCourse4CourseCode',
  'SendCourse4CourseTitle',
  'SendCourse4Units',

  // Send Course 5
  'SendCourse5CourseCode',
  'SendCourse5CourseTitle',
  'SendCourse5Units',

  // Send Course 6
  'SendCourse6CourseCode',
  'SendCourse6CourseTitle',
  'SendCourse6Units',

  // Send Course 7
  'SendCourse7CourseCode',
  'SendCourse7CourseTitle',
  'SendCourse7Units',

  // Send Course 8
  'SendCourse8CourseCode',
  'SendCourse8CourseTitle',
  'SendCourse8Units',

  // Send Course 9
  'SendCourse9CourseCode',
  'SendCourse9CourseTitle',
  'SendCourse9Units',

  // Send Course 10
  'SendCourse10CourseCode',
  'SendCourse10CourseTitle',
  'SendCourse10Units',

  // Receive (Target) Institution Information
  'ReceiveInstitution',
  'ReceiveEditionLowYear',
  'ReceiveEditionHighYear',

  // Receive Course 1
  'ReceiveCourse1CourseCode',
  'ReceiveCourse1CourseTitle',
  'ReceiveCourse1Units',

  // Receive Course 2
  'ReceiveCourse2CourseCode',
  'ReceiveCourse2CourseTitle',
  'ReceiveCourse2Units',

  // Receive Course 3
  'ReceiveCourse3CourseCode',
  'ReceiveCourse3CourseTitle',
  'ReceiveCourse3Units',

  // Receive Course 4
  'ReceiveCourse4CourseCode',
  'ReceiveCourse4CourseTitle',
  'ReceiveCourse4Units',
] as const;

/**
 * Type representing any valid column header from the boise-rules.csv file
 */
export type BoiseRulesHeader = (typeof BOISE_RULES_HEADERS)[number];

/**
 * Total number of columns in the CSV
 */
export const BOISE_RULES_COLUMN_COUNT = BOISE_RULES_HEADERS.length;

// ============================================================================
// Grouped Column References
// ============================================================================

/**
 * Send (source) institution information columns
 */
export const SEND_INSTITUTION_COLUMNS = [
  'SendInstitution',
  'SendInstitutionCity',
  'SendInstitutionState',
  'SendInstitutionCountry',
  'SendInstitutionIPEDSID',
  'SendEditionLowYear',
  'SendEditionHighYear',
] as const;

/**
 * Receive (target) institution information columns
 */
export const RECEIVE_INSTITUTION_COLUMNS = [
  'ReceiveInstitution',
  'ReceiveEditionLowYear',
  'ReceiveEditionHighYear',
] as const;

/**
 * All send course columns (1-10)
 */
export const SEND_COURSE_COLUMNS = [
  'SendCourse1CourseCode',
  'SendCourse1CourseTitle',
  'SendCourse1Units',
  'SendCourse2CourseCode',
  'SendCourse2CourseTitle',
  'SendCourse2Units',
  'SendCourse3CourseCode',
  'SendCourse3CourseTitle',
  'SendCourse3Units',
  'SendCourse4CourseCode',
  'SendCourse4CourseTitle',
  'SendCourse4Units',
  'SendCourse5CourseCode',
  'SendCourse5CourseTitle',
  'SendCourse5Units',
  'SendCourse6CourseCode',
  'SendCourse6CourseTitle',
  'SendCourse6Units',
  'SendCourse7CourseCode',
  'SendCourse7CourseTitle',
  'SendCourse7Units',
  'SendCourse8CourseCode',
  'SendCourse8CourseTitle',
  'SendCourse8Units',
  'SendCourse9CourseCode',
  'SendCourse9CourseTitle',
  'SendCourse9Units',
  'SendCourse10CourseCode',
  'SendCourse10CourseTitle',
  'SendCourse10Units',
] as const;

/**
 * All receive course columns (1-4)
 */
export const RECEIVE_COURSE_COLUMNS = [
  'ReceiveCourse1CourseCode',
  'ReceiveCourse1CourseTitle',
  'ReceiveCourse1Units',
  'ReceiveCourse2CourseCode',
  'ReceiveCourse2CourseTitle',
  'ReceiveCourse2Units',
  'ReceiveCourse3CourseCode',
  'ReceiveCourse3CourseTitle',
  'ReceiveCourse3Units',
  'ReceiveCourse4CourseCode',
  'ReceiveCourse4CourseTitle',
  'ReceiveCourse4Units',
] as const;

// ============================================================================
// Zod Schema
// ============================================================================

/**
 * Zod schema for a single row in the boise-rules.csv file.
 * All fields are strings since the data is imported as TEXT type.
 */
export const BoiseRulesRowSchema = z.object({
  // Send Institution
  SendInstitution: z.string().nullish(),
  SendInstitutionCity: z.string().nullish(),
  SendInstitutionState: z.string().nullish(),
  SendInstitutionCountry: z.string().nullish(),
  SendInstitutionIPEDSID: z.string().nullish(),
  SendEditionLowYear: z.string().nullish(),
  SendEditionHighYear: z.string().nullish(),

  // Send Courses (1-10)
  SendCourse1CourseCode: z.string().nullish(),
  SendCourse1CourseTitle: z.string().nullish(),
  SendCourse1Units: z.string().nullish(),
  SendCourse2CourseCode: z.string().nullish(),
  SendCourse2CourseTitle: z.string().nullish(),
  SendCourse2Units: z.string().nullish(),
  SendCourse3CourseCode: z.string().nullish(),
  SendCourse3CourseTitle: z.string().nullish(),
  SendCourse3Units: z.string().nullish(),
  SendCourse4CourseCode: z.string().nullish(),
  SendCourse4CourseTitle: z.string().nullish(),
  SendCourse4Units: z.string().nullish(),
  SendCourse5CourseCode: z.string().nullish(),
  SendCourse5CourseTitle: z.string().nullish(),
  SendCourse5Units: z.string().nullish(),
  SendCourse6CourseCode: z.string().nullish(),
  SendCourse6CourseTitle: z.string().nullish(),
  SendCourse6Units: z.string().nullish(),
  SendCourse7CourseCode: z.string().nullish(),
  SendCourse7CourseTitle: z.string().nullish(),
  SendCourse7Units: z.string().nullish(),
  SendCourse8CourseCode: z.string().nullish(),
  SendCourse8CourseTitle: z.string().nullish(),
  SendCourse8Units: z.string().nullish(),
  SendCourse9CourseCode: z.string().nullish(),
  SendCourse9CourseTitle: z.string().nullish(),
  SendCourse9Units: z.string().nullish(),
  SendCourse10CourseCode: z.string().nullish(),
  SendCourse10CourseTitle: z.string().nullish(),
  SendCourse10Units: z.string().nullish(),

  // Receive Institution
  ReceiveInstitution: z.string().nullish(),
  ReceiveEditionLowYear: z.string().nullish(),
  ReceiveEditionHighYear: z.string().nullish(),

  // Receive Courses (1-4)
  ReceiveCourse1CourseCode: z.string().nullish(),
  ReceiveCourse1CourseTitle: z.string().nullish(),
  ReceiveCourse1Units: z.string().nullish(),
  ReceiveCourse2CourseCode: z.string().nullish(),
  ReceiveCourse2CourseTitle: z.string().nullish(),
  ReceiveCourse2Units: z.string().nullish(),
  ReceiveCourse3CourseCode: z.string().nullish(),
  ReceiveCourse3CourseTitle: z.string().nullish(),
  ReceiveCourse3Units: z.string().nullish(),
  ReceiveCourse4CourseCode: z.string().nullish(),
  ReceiveCourse4CourseTitle: z.string().nullish(),
  ReceiveCourse4Units: z.string().nullish(),
});

/**
 * TypeScript type inferred from the Zod schema
 */
export type BoiseRulesRow = z.infer<typeof BoiseRulesRowSchema>;

/**
 * Dynamic Zod schema builder that creates a schema from CSV headers.
 * Useful for validating data when column order might differ.
 */
export function createBoiseRulesSchemaFromHeaders(headers: string[]): z.ZodObject<any> {
  const schemaFields = headers.reduce(
    (obj, key) => {
      obj[key] = z.string().nullish();
      return obj;
    },
    {} as Record<string, z.ZodOptional<z.ZodNullable<z.ZodString>>>,
  );

  return z.object(schemaFields);
}

// ============================================================================
// File Loading Utilities
// ============================================================================

/**
 * Load the entire boise-rules.csv file as a string
 * @deprecated Use getHeadersOnly() and getExpectedRowCountFast() for better performance
 */
export function loadBoiseRulesFile(): string {
  return readFileSync(BOISE_RULES_FILE_PATH, 'utf-8');
}

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
 * Load the boise-rules.csv file and return its content and metadata
 */
export function loadBoiseRulesFileWithMetadata() {
  const content = loadBoiseRulesFile();
  const lines = content.trim().split('\n');
  const headerLine = lines[0] || '';
  const headers = headerLine.split(',').map((h) => h.trim());
  const dataRowCount = lines.length - 1; // Subtract header

  return {
    content,
    headers,
    headerLine,
    totalLines: lines.length,
    dataRowCount,
    fileSize: Buffer.byteLength(content, 'utf-8'),
  };
}

/**
 * Extract headers from a CSV content string
 */
export function extractCsvHeaders(csvContent: string): string[] {
  const [headerLine] = csvContent.split('\n');
  return headerLine?.split(',').map((c) => c.trim()) ?? [];
}

/**
 * Validate that the CSV file has the expected headers
 */
export function validateBoiseRulesHeaders(csvContent: string): boolean {
  const actualHeaders = extractCsvHeaders(csvContent);

  if (actualHeaders.length !== BOISE_RULES_HEADERS.length) {
    return false;
  }

  return actualHeaders.every((header, index) => header === BOISE_RULES_HEADERS[index]);
}

/**
 * Get expected row count from CSV content (excludes header)
 */
export function getExpectedRowCount(csvContent: string): number {
  const lines = csvContent.trim().split('\n');
  return Math.max(0, lines.length - 1); // Subtract header line
}

// ============================================================================
// Data Transformation Utilities
// ============================================================================

/**
 * Parse a CSV line into an object using the standard headers
 * Note: This is a simple parser and doesn't handle quoted commas
 */
export function parseBoiseRulesRow(line: string): BoiseRulesRow | null {
  const values = line.split(',').map((v) => v.trim());

  if (values.length !== BOISE_RULES_HEADERS.length) {
    return null;
  }

  const row: any = {};
  BOISE_RULES_HEADERS.forEach((header, index) => {
    row[header] = values[index] || '';
  });

  try {
    return BoiseRulesRowSchema.parse(row);
  } catch {
    return null;
  }
}

/**
 * Extract send courses from a row (filters out empty courses)
 */
export function extractSendCourses(row: BoiseRulesRow) {
  const courses = [];

  for (let i = 1; i <= 10; i++) {
    const codeKey = `SendCourse${i}CourseCode` as keyof BoiseRulesRow;
    const titleKey = `SendCourse${i}CourseTitle` as keyof BoiseRulesRow;
    const unitsKey = `SendCourse${i}Units` as keyof BoiseRulesRow;

    const code = row[codeKey];
    const title = row[titleKey];
    const units = row[unitsKey];

    if (code && code.length > 0) {
      courses.push({
        courseNumber: i,
        code,
        title,
        units,
      });
    }
  }

  return courses;
}

/**
 * Extract receive courses from a row (filters out empty courses)
 */
export function extractReceiveCourses(row: BoiseRulesRow) {
  const courses = [];

  for (let i = 1; i <= 4; i++) {
    const codeKey = `ReceiveCourse${i}CourseCode` as keyof BoiseRulesRow;
    const titleKey = `ReceiveCourse${i}CourseTitle` as keyof BoiseRulesRow;
    const unitsKey = `ReceiveCourse${i}Units` as keyof BoiseRulesRow;

    const code = row[codeKey];
    const title = row[titleKey];
    const units = row[unitsKey];

    if (code && code.length > 0) {
      courses.push({
        courseNumber: i,
        code,
        title,
        units,
      });
    }
  }

  return courses;
}

// ============================================================================
// Test/Table Name Constants
// ============================================================================

/**
 * Default table name for importing boise-rules.csv into PostgreSQL
 */
export const BOISE_RULES_TABLE_NAME = 'boise_rules';

/**
 * Alternative table names for different test scenarios
 */
export const BOISE_RULES_TABLE_NAMES = {
  DEFAULT: 'boise_rules',
  INTEGRITY: 'boise_rules_integrity',
  TRUNCATE: 'boise_rules_truncate',
  DROP: 'boise_rules_drop',
  BATCH: 'boise_rules_batch',
} as const;
