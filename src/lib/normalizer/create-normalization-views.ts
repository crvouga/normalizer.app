import { z } from 'zod';
import { runAgenticLoop, type ExecutableTool } from '../llm/agentic-loop';
import type { LLM } from '../llm/llm';
import type { Logger } from '../logger';
import { Err, isErr, Ok, type Result } from '../result';
import type { SqlDb } from '../sql-db/sql-db';

export async function createNormalizationViews({
  inputs,
  targets,
  outputs,
  llm,
  sqlDb,
  logger,
}: {
  inputs: Array<{ viewName: string }>;
  targets: Array<{ viewName: string }>;
  outputs: Array<{ viewName: string }>;
  llm: LLM;
  sqlDb: SqlDb;
  logger: Logger;
}): Promise<Result<null, string>> {
  logger.debug('Starting normalization view creation', {
    inputCount: inputs.length,
    targetCount: targets.length,
    outputCount: outputs.length,
  });

  const inputTableNames = inputs.map((input) => input.viewName);
  const targetTableNames = targets.map((target) => target.viewName);
  const outputViewNames = outputs.map((output) => output.viewName);

  const queryDatabaseSchema = z.object({
    query: z
      .string()
      .describe(
        'A SQL query to execute against the database. Can be SELECT queries to inspect schemas, or CREATE/DROP/ALTER statements to create views, materialized views, tables, indexes, etc.',
      ),
  });

  const queryDatabaseTool: ExecutableTool = {
    name: 'query_database',
    description:
      'Execute a SQL query (SELECT to inspect, CREATE to change the schema) against the PostgreSQL database.',
    parameters: queryDatabaseSchema,
    async execute(args: unknown) {
      const query = queryDatabaseSchema.parse(args).query.trim();
      const result = await sqlDb.unsafe(query);
      if (isErr(result)) {
        return JSON.stringify({ error: result.error });
      }
      if (Array.isArray(result.value)) {
        return JSON.stringify({ rows: result.value });
      }
      if (result.value && typeof result.value === 'object' && 'rowCount' in result.value) {
        return JSON.stringify({ rowCount: result.value.rowCount });
      }
      return JSON.stringify({ result: result.value });
    },
  };

  const systemPrompt = toSystemPrompt({
    inputTableNames,
    targetTableNames,
    outputViewNames,
  });

  const loopResult = await runAgenticLoop({
    llm,
    initialMessages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content:
          'First, use the query_database tool with SELECT queries to inspect the schemas of the input and target tables. Then create the output views (or materialized views, tables, indexes, etc. as needed) directly using CREATE statements executed via the query_database tool.',
      },
    ],
    tools: [queryDatabaseTool],
    logger,
    shouldContinue(_message, iteration) {
      if (iteration === 0) {
        return {
          shouldContinue: true,
          followUpMessage:
            "You MUST use the query_database tool to inspect the table schemas. I cannot proceed without knowing the actual column names and data types. Please call query_database with queries like: \"SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('input_0', 'target_0') ORDER BY table_name, ordinal_position\" to see the schemas.",
        };
      }

      if (iteration === 1) {
        return {
          shouldContinue: true,
          followUpMessage:
            'You need to use the query_database tool NOW. Do not explain or give examples. Call the tool with a SELECT query to inspect the tables. Start with: query_database({"query": "SELECT * FROM input_0 LIMIT 1"})',
        };
      }

      logger.debug('No tool calls detected, assuming database objects have been created', {
        iteration: iteration + 1,
      });
      return { shouldContinue: false };
    },
  });

  if (isErr(loopResult)) {
    logger.error('Failed to create normalization views', { error: loopResult.error });
    return Err(loopResult.error);
  }

  logger.debug('Normalization views created successfully');
  return Ok(null);
}

/**
 * Generates the system prompt for normalization view creation
 */
function toSystemPrompt(params: {
  inputTableNames: string[];
  targetTableNames: string[];
  outputViewNames: string[];
}): string {
  const { inputTableNames, targetTableNames, outputViewNames } = params;
  return `You are a PostgreSQL expert. Create database objects (views, materialized views, tables, indexes, etc.) that transform input tables to match target table schemas exactly.

Tables:
- Inputs: ${inputTableNames.join(', ')}
- Targets: ${targetTableNames.join(', ')} (define desired schemas)
- Outputs: ${outputViewNames.join(', ')} (views/objects to create)

Use the query_database tool to inspect actual schemas and data with SELECT queries. Then create the necessary database objects directly using CREATE statements executed via the query_database tool. You may need to create:
- Regular views (CREATE OR REPLACE VIEW)
- Materialized views (CREATE MATERIALIZED VIEW) if performance requires it
- Temporary tables (CREATE TEMP TABLE) if intermediate transformations are needed
- Indexes (CREATE INDEX) if needed for performance
- Any other database objects required for the transformation

Map input columns to target columns intelligently (handle naming variations, type conversions, NULLs as needed).

IMPORTANT: PostgreSQL converts unquoted identifiers to lowercase. You MUST use double quotes around ALL column aliases to preserve their case exactly as they appear in the target table. For example: SELECT col AS "MixedCaseColumn" (not AS MixedCaseColumn).

Create all necessary database objects directly in the database using the query_database tool.`;
}
