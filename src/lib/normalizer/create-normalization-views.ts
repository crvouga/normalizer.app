import { z } from 'zod';
import { AgenticLoop, type ExecutableTool } from '../llm/agentic-loop';
import type { LLM } from '../llm/llm';
import type { Logger } from '../logger';
import { Err, isErr, Ok, type Result } from '../result';
import type { SqlDb } from '../sql-db/sql-db';

/**
 * Create normalization views that transform input tables to match target schemas.
 * Uses an agentic loop with the LLM and a SQL tool for iterative view creation.
 */
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
  logger.info('Starting normalization view creation', {
    inputCount: inputs.length,
    targetCount: targets.length,
    outputCount: outputs.length,
    inputTableNames: inputs.map((input) => input.viewName),
    targetTableNames: targets.map((target) => target.viewName),
    outputViewNames: outputs.map((output) => output.viewName),
  });

  const inputTableNames = inputs.map((input) => input.viewName);
  const targetTableNames = targets.map((target) => target.viewName);
  const outputViewNames = outputs.map((output) => output.viewName);
  const queryDatabaseTool = createQueryDatabaseTool({ sqlDb, logger });
  const systemPrompt = createSystemPrompt({ inputTableNames, targetTableNames, outputViewNames });

  logger.debug('System prompt for normalization view creation', { prompt: systemPrompt });

  const agentLoop = new AgenticLoop({
    llm,
    logger,
  });

  const ran = await agentLoop.run({
    tools: [queryDatabaseTool],
    goal: {
      description:
        'Create normalization views that transform input tables to match target schemas exactly.',
    },
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
  });

  if (isErr(ran)) {
    logger.error('Failed to create normalization views', { error: ran.error });
    return Err(ran.error);
  }

  logger.info('Normalization views created successfully', {
    stepNumber: ran.value.stepNumber,
    phase: ran.value.phase,
    completedNormally: ran.value.completedNormally,
    budgetUsed: ran.value.budgetUsed,
  });

  return Ok(null);
}

/**
 * Generates the system prompt for normalization view creation
 */
function createSystemPrompt(params: {
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

CRITICAL WORKFLOW:
1. First, inspect the ACTUAL column names in the input tables using: SELECT * FROM ${inputTableNames[0]} LIMIT 0; or query information_schema.columns
2. Then, inspect the ACTUAL column names in the target tables using the same approach
3. Create views that SELECT from input tables using the ACTUAL column names (which PostgreSQL converts to lowercase if unquoted), and ALIAS them to match the target schema exactly

IMPORTANT COLUMN NAME HANDLING:
- PostgreSQL converts unquoted identifiers to lowercase. When you query input tables, the column names will be lowercase (e.g., "description", "instructor_email")
- You MUST use the actual lowercase column names from the input table in your SELECT statements
- You MUST use double quotes around ALL column aliases in the SELECT to preserve their case exactly as they appear in the target table
- Example: SELECT description AS "CourseDescription", instructor_email AS "CourseInstructorEmail" FROM input_0;
- DO NOT try to select from input tables using capitalized column names - they don't exist! Always use the actual lowercase names.

Use the query_database tool to inspect actual schemas and data with SELECT queries. Then create the necessary database objects directly using CREATE statements executed via the query_database tool. You may need to create:
- Regular views (CREATE OR REPLACE VIEW)
- Materialized views (CREATE MATERIALIZED VIEW) if performance requires it
- Temporary tables (CREATE TEMP TABLE) if intermediate transformations are needed
- Indexes (CREATE INDEX) if needed for performance
- Any other database objects required for the transformation

Map input columns to target columns intelligently (handle naming variations, type conversions, NULLs as needed).

Create all necessary database objects directly in the database using the query_database tool.`;
}

/**
 * Creates the query_database tool with logging of executed queries and errors.
 */
function createQueryDatabaseTool({
  sqlDb,
  logger,
}: {
  sqlDb: SqlDb;
  logger: Logger;
}): ExecutableTool {
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
    async execute(args) {
      const { query } = queryDatabaseSchema.parse(args);
      try {
        logger.debug('Executing query_database tool', { query });
        const result = await sqlDb.unsafe(query.trim());

        if (isErr(result)) {
          logger.warn('query_database tool error', { query, error: result.error });
          return JSON.stringify({ error: result.error });
        }

        const value = result.value;

        if (Array.isArray(value)) {
          logger.debug('query_database tool returned rows', { rowCount: value.length });
          return JSON.stringify({ rows: value });
        }

        if (value && typeof value === 'object' && 'rowCount' in value) {
          logger.debug('query_database tool result has rowCount', {
            rowCount: value.rowCount,
          });
          return JSON.stringify({ rowCount: value.rowCount });
        }

        logger.debug('query_database tool returned generic result', { result: value });
        return JSON.stringify({ result: value });
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
        logger.error('Exception in query_database tool', { error: errMsg, query });
        return JSON.stringify({ error: errMsg });
      }
    },
  };

  return queryDatabaseTool;
}
