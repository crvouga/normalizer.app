import { findQueryJsonObjectsInContent } from '~/src/lib/llm/find-query-json-objects-in-content';

export type ReasoningDisplaySegment =
  | { type: 'text'; content: string }
  | { type: 'sql'; content: string };

const INCOMPLETE_QUERY_JSON_PATTERN = /\{\s*"query"\s*:\s*"?[^}]*$/;

function trimIncompleteTrailingQueryJson(text: string): string {
  const match = text.match(INCOMPLETE_QUERY_JSON_PATTERN);
  if (!match || match.index === undefined) {
    return text;
  }

  return text.slice(0, match.index);
}

export function parseReasoningDisplaySegments(text: string): ReasoningDisplaySegment[] {
  const matches = findQueryJsonObjectsInContent(text);

  if (matches.length === 0) {
    const trimmed = trimIncompleteTrailingQueryJson(text).trim();
    return trimmed.length > 0 ? [{ type: 'text', content: trimmed }] : [];
  }

  const segments: ReasoningDisplaySegment[] = [];
  let cursor = 0;

  for (const match of matches) {
    const textBefore = text.slice(cursor, match.start).trim();
    if (textBefore.length > 0) {
      segments.push({ type: 'text', content: textBefore });
    }

    segments.push({ type: 'sql', content: match.query });
    cursor = match.end;
  }

  const remaining = trimIncompleteTrailingQueryJson(text.slice(cursor)).trim();
  if (remaining.length > 0) {
    segments.push({ type: 'text', content: remaining });
  }

  return segments;
}
