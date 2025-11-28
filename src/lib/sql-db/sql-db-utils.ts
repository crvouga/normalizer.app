import { z } from 'zod';

/**
 * Schema for validating params array
 */
export const paramsSchema = z.array(z.unknown());

/**
 * Helper to extract row count from execute result
 * For INSERT/UPDATE/DELETE with RETURNING, postgres returns the rows
 * For INSERT/UPDATE/DELETE without RETURNING, postgres returns empty array
 * We modify queries to add RETURNING to get the actual row count
 */
export function extractRowCount(result: unknown): number {
  // If result is an array, the length is the row count (from RETURNING clause)
  if (Array.isArray(result)) {
    return result.length;
  }
  // If result is an object, check for count/rowCount properties
  if (typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>;
    if (typeof obj.count === 'number') {
      return obj.count;
    }
    if (typeof obj.rowCount === 'number') {
      return obj.rowCount;
    }
  }
  return 0;
}

/**
 * Modifies INSERT/UPDATE/DELETE queries to add RETURNING * if not present
 * This allows us to get the row count. Skips DDL statements.
 */
export function addReturningIfNeeded(query: string): string {
  const trimmedQuery = query.trim();
  const upperQuery = trimmedQuery.toUpperCase();

  // Skip DDL statements (CREATE, DROP, ALTER, etc.)
  const ddlKeywords = ['CREATE', 'DROP', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE'];
  if (ddlKeywords.some((keyword) => upperQuery.startsWith(keyword))) {
    return query;
  }

  const isInsert = upperQuery.startsWith('INSERT');
  const isUpdate = upperQuery.startsWith('UPDATE');
  const isDelete = upperQuery.startsWith('DELETE');

  if ((isInsert || isUpdate || isDelete) && !upperQuery.includes('RETURNING')) {
    // Find the end of the query (before semicolon if present)
    const semicolonIndex = trimmedQuery.lastIndexOf(';');
    const queryWithoutSemicolon =
      semicolonIndex !== -1 ? trimmedQuery.slice(0, semicolonIndex).trim() : trimmedQuery.trim();

    // Add RETURNING * before semicolon or at the end
    const modifiedQuery = queryWithoutSemicolon + ' RETURNING *';
    return semicolonIndex !== -1 ? modifiedQuery + ';' : modifiedQuery;
  }

  return query;
}
