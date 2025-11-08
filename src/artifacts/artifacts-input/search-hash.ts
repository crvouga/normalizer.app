/**
 * Generates a hash key from search parameters for caching search results.
 * Uses JSON stringification for deterministic hashing.
 */
export function generateSearchHash(params: {
  query: string;
  page: number;
  pageSize: number;
}): string {
  return JSON.stringify(params);
}
