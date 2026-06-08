import type { ToolCall } from './llm';

/**
 * Some models (e.g. gpt-5-chat-latest) emit {"query":"..."} as plain text instead of
 * using the function-calling API. Extract those so the agentic loop can still execute SQL.
 */
export function parseQueryDatabaseToolCallsFromContent(content: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  let searchFrom = 0;

  while (searchFrom < content.length) {
    const queryKeyIdx = content.indexOf('"query"', searchFrom);
    if (queryKeyIdx === -1) {
      break;
    }

    const openBrace = content.lastIndexOf('{', queryKeyIdx);
    if (openBrace === -1) {
      searchFrom = queryKeyIdx + 1;
      continue;
    }

    const parsed = tryParseJsonObjectAt(content, openBrace);
    if (parsed && typeof parsed.query === 'string' && parsed.query.trim().length > 0) {
      toolCalls.push({
        id: `synthesized_${toolCalls.length}`,
        name: 'query_database',
        arguments: { query: parsed.query },
      });
    }

    searchFrom = queryKeyIdx + 1;
  }

  return toolCalls;
}

function tryParseJsonObjectAt(content: string, start: number): { query?: string } | null {
  let inString = false;
  let escape = false;
  let depth = 0;

  for (let i = start; i < content.length; i++) {
    const char = content[i]!;

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(content.slice(start, i + 1)) as { query?: string };
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}
