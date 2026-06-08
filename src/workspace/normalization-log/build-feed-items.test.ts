import { describe, expect, test } from 'bun:test';
import type { NormalizationLog } from './normalization-log';
import { buildFeedItems, getPreviewItems } from './build-feed-items';

describe('buildFeedItems', () => {
  test('places query_result after reasoning flush and before later progress', () => {
    const logs: NormalizationLog[] = [
      {
        seq: 1,
        kind: 'reasoning',
        level: 'info',
        scope: '',
        message: '{"query":"SELECT 1;"}',
        createdAt: new Date(),
      },
      {
        seq: 2,
        kind: 'progress',
        level: 'info',
        scope: '',
        message: 'Applying changes...',
        createdAt: new Date(),
      },
      {
        seq: 3,
        kind: 'query_result',
        level: 'info',
        scope: '',
        message: '1 row',
        meta: { resultType: 'rows', rows: [{ '?column?': 1 }], totalRowCount: 1 },
        createdAt: new Date(),
      },
    ];

    const items = buildFeedItems(logs);

    expect(items.map((item) => item.type)).toEqual(['reasoning', 'progress', 'query_result']);
  });

  test('preview omits reasoning when latest query_result includes query', () => {
    const items = buildFeedItems([
      {
        seq: 1,
        kind: 'reasoning',
        level: 'info',
        scope: '',
        message: '{"query":"SELECT 1;"}',
        createdAt: new Date(),
      },
      {
        seq: 2,
        kind: 'progress',
        level: 'info',
        scope: '',
        message: 'Applying changes...',
        createdAt: new Date(),
      },
      {
        seq: 3,
        kind: 'query_result',
        level: 'info',
        scope: '',
        message: '1 row',
        meta: {
          resultType: 'rows',
          query: 'SELECT 1;',
          rows: [{ '?column?': 1 }],
          totalRowCount: 1,
        },
        createdAt: new Date(),
      },
    ]);

    const preview = getPreviewItems(items, 2);

    expect(preview.map((item) => item.type)).toEqual(['progress', 'query_result']);
  });
});
