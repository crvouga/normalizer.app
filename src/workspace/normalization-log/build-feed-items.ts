import type { NormalizationLog } from './normalization-log';
import { parseQueryResultLogMeta, type QueryResultLogMeta } from './query-result-log-meta';

export type FeedItem =
  | { type: 'progress'; key: string; message: string; isError?: boolean }
  | { type: 'reasoning'; key: string; text: string }
  | { type: 'query_result'; key: string; message: string; meta: QueryResultLogMeta };

export function buildFeedItems(logs: NormalizationLog[]): FeedItem[] {
  const items: FeedItem[] = [];
  let reasoningBuffer = '';
  let reasoningKey: string | null = null;

  const flushReasoning = () => {
    if (reasoningBuffer.length === 0 || reasoningKey === null) {
      return;
    }

    items.push({
      type: 'reasoning',
      key: reasoningKey,
      text: reasoningBuffer,
    });
    reasoningBuffer = '';
    reasoningKey = null;
  };

  for (const log of logs) {
    const kind = log.kind ?? 'progress';

    if (kind === 'reasoning') {
      if (reasoningKey === null) {
        reasoningKey = `reasoning-${log.seq}`;
      }
      reasoningBuffer += log.message;
      continue;
    }

    flushReasoning();

    if (kind === 'query_result') {
      const meta = parseQueryResultLogMeta(log.meta);
      if (meta) {
        items.push({
          type: 'query_result',
          key: `query-result-${log.seq}`,
          message: log.message,
          meta,
        });
      }
      continue;
    }

    items.push({
      type: 'progress',
      key: `progress-${log.seq}`,
      message: log.message,
      isError: kind === 'error' || log.level === 'error',
    });
  }

  flushReasoning();
  return items;
}

export function getPreviewItems(items: FeedItem[], previewProgressCount: number): FeedItem[] {
  const progressItems = items.filter((item) => item.type === 'progress');
  const reasoningItems = items.filter((item) => item.type === 'reasoning');
  const queryResultItems = items.filter((item) => item.type === 'query_result');
  const latestQueryResult =
    queryResultItems.length > 0 ? queryResultItems[queryResultItems.length - 1]! : null;
  const latestQueryResultHasQuery =
    latestQueryResult?.type === 'query_result' && latestQueryResult.meta.query !== undefined;

  const selected = [
    ...progressItems.slice(Math.max(0, progressItems.length - previewProgressCount)),
    ...(!latestQueryResultHasQuery && reasoningItems.length > 0
      ? [reasoningItems[reasoningItems.length - 1]!]
      : []),
    ...(latestQueryResult ? [latestQueryResult] : []),
  ];

  const selectedKeys = new Set(selected.map((item) => item.key));
  return items.filter((item) => selectedKeys.has(item.key));
}
