import { describe, expect, test } from 'bun:test';
import { parseQueryDatabaseToolCallsFromContent } from './parse-tool-calls-from-content';

describe('parseQueryDatabaseToolCallsFromContent', () => {
  test('parses multiple JSON query objects from text content', () => {
    const content = `{
  "query": "SELECT column_name FROM information_schema.columns WHERE table_name = 'input_0';"
}
{
  "query": "SELECT column_name FROM information_schema.columns WHERE table_name = 'target_0';"
}`;

    const toolCalls = parseQueryDatabaseToolCallsFromContent(content);
    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0]!.name).toBe('query_database');
    expect(toolCalls[0]!.arguments).toEqual({
      query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'input_0';",
    });
  });

  test('parses CREATE VIEW SQL with escaped quotes', () => {
    const content = `{
  "query": "CREATE OR REPLACE VIEW \\"output_0\\" AS SELECT 1::int AS \\"CourseIdentifier\\";"
}`;

    const toolCalls = parseQueryDatabaseToolCallsFromContent(content);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.arguments).toEqual({
      query: 'CREATE OR REPLACE VIEW "output_0" AS SELECT 1::int AS "CourseIdentifier";',
    });
  });
});
