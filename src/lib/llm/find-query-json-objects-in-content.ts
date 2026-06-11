export type QueryJsonObjectMatch = {
  query: string;
  start: number;
  end: number;
};

export function findJsonObjectEnd(content: string, start: number): number | null {
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
        return i;
      }
    }
  }

  return null;
}

function tryParseJsonObjectAt(content: string, start: number): { query?: string } | null {
  const end = findJsonObjectEnd(content, start);
  if (end === null) {
    return null;
  }

  try {
    return JSON.parse(content.slice(start, end + 1)) as { query?: string };
  } catch {
    return null;
  }
}

export function findQueryJsonObjectsInContent(content: string): QueryJsonObjectMatch[] {
  const matches: QueryJsonObjectMatch[] = [];
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
      const end = findJsonObjectEnd(content, openBrace);
      if (end !== null) {
        matches.push({
          query: parsed.query,
          start: openBrace,
          end: end + 1,
        });
        searchFrom = end + 1;
        continue;
      }
    }

    searchFrom = queryKeyIdx + 1;
  }

  return matches;
}
