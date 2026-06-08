import { describe, expect, test } from 'bun:test';
import { parseReasoningDisplaySegments } from './parse-reasoning-display-segments';

describe('parseReasoningDisplaySegments', () => {
  test('extracts SQL from concatenated JSON query envelopes', () => {
    const text =
      '{"query": "SELECT column_name FROM information_schema.columns WHERE table_name = \'input_0\';"}' +
      '{"query": "SELECT column_name FROM information_schema.columns WHERE table_name = \'target_0\';"}';

    const segments = parseReasoningDisplaySegments(text);

    expect(segments).toEqual([
      {
        type: 'sql',
        content: "SELECT column_name FROM information_schema.columns WHERE table_name = 'input_0';",
      },
      {
        type: 'sql',
        content:
          "SELECT column_name FROM information_schema.columns WHERE table_name = 'target_0';",
      },
    ]);
  });

  test('extracts CREATE VIEW SQL from JSON envelope', () => {
    const text =
      '{"query":"CREATE OR REPLACE VIEW output_0 AS\\nSELECT\\n NULL::text AS \\"InstitutionUniqueIdentifier\\"\\nFROM input_0;"}';

    const segments = parseReasoningDisplaySegments(text);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual({
      type: 'sql',
      content:
        'CREATE OR REPLACE VIEW output_0 AS\nSELECT\n NULL::text AS "InstitutionUniqueIdentifier"\nFROM input_0;',
    });
  });

  test('keeps non-JSON reasoning text as plain text', () => {
    const text = 'I should inspect the input schema first.';

    const segments = parseReasoningDisplaySegments(text);

    expect(segments).toEqual([{ type: 'text', content: text }]);
  });

  test('hides incomplete trailing JSON while streaming', () => {
    const text = '{"query": "SELECT 1';

    expect(parseReasoningDisplaySegments(text)).toEqual([]);
  });

  test('preserves plain text before SQL envelopes', () => {
    const text = `Checking schemas first.
{"query": "SELECT 1;"}`;

    const segments = parseReasoningDisplaySegments(text);

    expect(segments).toEqual([
      { type: 'text', content: 'Checking schemas first.' },
      { type: 'sql', content: 'SELECT 1;' },
    ]);
  });
});
