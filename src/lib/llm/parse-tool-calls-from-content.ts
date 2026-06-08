import type { ToolCall } from './llm';
import { findQueryJsonObjectsInContent } from './find-query-json-objects-in-content';

/**
 * Some models (e.g. gpt-5-chat-latest) emit {"query":"..."} as plain text instead of
 * using the function-calling API. Extract those so the agentic loop can still execute SQL.
 */
export function parseQueryDatabaseToolCallsFromContent(content: string): ToolCall[] {
  return findQueryJsonObjectsInContent(content).map((match, index) => ({
    id: `synthesized_${index}`,
    name: 'query_database',
    arguments: { query: match.query },
  }));
}
