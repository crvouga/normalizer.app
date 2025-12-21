import { z } from 'zod';
import type { LLM, Message, ToolCall, ToolDefinition } from '../llm/llm';
import type { Logger } from '../logger';
import type { SqlDb } from '../sql-db/sql-db';
import { isErr } from '../result';

// Define the query_database tool schema
const queryDatabaseSchema = z.object({
  query: z
    .string()
    .describe(
      'A SQL query to execute against the database. Can be any valid PostgreSQL statement including SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, etc.',
    ),
});

export async function generatePostgresScript({
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
}): Promise<string> {
  logger.debug('Starting PostgreSQL script generation', {
    inputCount: inputs.length,
    targetCount: targets.length,
    outputCount: outputs.length,
  });

  const inputTableNames = inputs.map((input) => input.viewName).join(', ');
  const targetTableNames = targets.map((target) => target.viewName).join(', ');
  const outputViewNames = outputs.map((output) => output.viewName).join(', ');

  // Define the query_database tool
  const queryDatabaseTool: ToolDefinition = {
    name: 'query_database',
    description:
      'Execute any SQL query against the PostgreSQL database. Can be used to inspect table schemas, column names, data types, sample data, create tables, insert data, or perform any other database operations. Examples: "SELECT * FROM input_0 LIMIT 5", "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'input_0\'", "CREATE TABLE test AS SELECT * FROM input_0"',
    parameters: queryDatabaseSchema,
  };

  const systemPrompt = `
You are a PostgreSQL expert specializing in data normalization and schema mapping.

Your task is to generate PostgreSQL scripts that create views mapping input tables to target schemas.

## Context

- Input tables are named: ${inputTableNames}
- Target tables are named: ${targetTableNames}
- Output views are named: ${outputViewNames}
- Target tables define the desired output schema (column names, types, structure)
- Input tables contain the source data that needs to be transformed to match the target schema

## Your Goal

Generate CREATE VIEW statements that transform the input data to match the target schema exactly.

## IMPORTANT: You MUST use the query_database tool first

Before generating any SQL script, you MUST use the query_database tool to:
1. Inspect the schema of each input table (column names, data types)
2. Inspect the schema of each target table (column names, data types)
3. View sample data from input tables to understand the data format

DO NOT generate SQL scripts without first inspecting the actual table structures using the query_database tool. You cannot know the column names or data types without querying the database.

## Requirements

1. **Schema Analysis**
   - Carefully examine the structure of each input table
   - Carefully examine the structure of each target table
   - Identify column mappings between inputs and targets based on semantic meaning

2. **Column Mapping**
   - Map input columns to target columns by analyzing column names and data patterns
   - Handle variations in naming conventions (snake_case, camelCase, PascalCase, etc.)
   - Perform intelligent matching (e.g., "instructor_name" → "CourseInstructor")

3. **Data Transformation**
   - Apply necessary data type conversions (e.g., TEXT to INTEGER, date formatting)
   - Handle NULL values appropriately
   - Preserve data integrity during transformations

4. **View Creation**
   - Create one output view per input table, named: ${outputViewNames}
   - Each view should select data from its corresponding input table (${outputViewNames} from ${inputTableNames}, etc.)
   - The view schema must exactly match the corresponding target table schema
   - Use the same column names, data types, and structure as the target

5. **SQL Best Practices**
   - Generate valid PostgreSQL syntax
   - Use explicit column aliases for clarity
   - Add comments explaining complex transformations
   - Ensure the script is idempotent (can be run multiple times safely)

## Output Format

Return ONLY valid PostgreSQL SQL statements. Do not include:

- Markdown code fences
- Explanatory text before or after the SQL
- Comments outside of SQL comments (-- or /\* \*/)

Example output structure:
-- Output input_0 to match target_0 schema
CREATE OR REPLACE VIEW ${outputViewNames[0]} AS
SELECT
input_column_1 AS TargetColumn1,
input_column_2 AS TargetColumn2,
CAST(input_column_3 AS INTEGER) AS TargetColumn3
FROM ${inputTableNames[0]};

-- Output input_1 to match target_1 schema
CREATE OR REPLACE VIEW ${outputViewNames[1]} AS
SELECT
different_col AS TargetColumn1,
another_col AS TargetColumn2
FROM ${inputTableNames[1]};

## Error Handling

- If a target column has no clear mapping in the input, use NULL with appropriate type casting
- If data types are incompatible, use appropriate PostgreSQL casting functions
- If you cannot confidently map the data, explain the issue in SQL comments

## Available Tools

You have access to a \`query_database\` tool that lets you execute any SQL query against the database.

**CRITICAL: You MUST call query_database BEFORE generating any SQL script.**

Do NOT explain what you would do. Do NOT give examples. Do NOT say you cannot access the database.
You CAN and MUST use the query_database tool to inspect the tables.

Start by calling query_database with queries like:
- \`SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('input_0', 'target_0') ORDER BY table_name, ordinal_position\` - To see all column schemas
- \`SELECT * FROM input_0 LIMIT 3\` - To see sample input data
- \`SELECT * FROM target_0 LIMIT 1\` - To see target schema structure

After inspecting the schemas with query_database, then generate the transformation script.

Generate precise, executable PostgreSQL code that transforms the input data to perfectly match the target schema.`;

  // Implement agentic loop with tool calls
  const messages: Message[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content:
        'First, use the query_database tool to inspect the schemas of the input and target tables. Then generate the PostgreSQL script to transform the input tables to match the target schemas.',
    },
  ];

  const MAX_ITERATIONS = 10;
  let iteration = 0;

  logger.debug('Starting agentic loop for script generation', {
    maxIterations: MAX_ITERATIONS,
  });

  while (iteration < MAX_ITERATIONS) {
    logger.debug('LLM iteration', {
      iteration: iteration + 1,
      maxIterations: MAX_ITERATIONS,
      messageCount: messages.length,
    });

    const response = await llm.completions(messages, {
      tools: [queryDatabaseTool],
    });

    const lastMessage = response[response.length - 1];

    if (!lastMessage || lastMessage.role !== 'assistant') {
      logger.warn('Unexpected message role or missing message', {
        iteration: iteration + 1,
        lastMessageRole: lastMessage?.role,
      });
      break;
    }

    messages.push(lastMessage);

    // Check if there are tool calls
    const hasToolCalls =
      'toolCalls' in lastMessage &&
      lastMessage.toolCalls !== undefined &&
      lastMessage.toolCalls.length > 0;

    if (hasToolCalls && lastMessage.toolCalls) {
      logger.debug('Executing tool calls', {
        iteration: iteration + 1,
        toolCallCount: lastMessage.toolCalls.length,
        toolCallNames: lastMessage.toolCalls.map((tc) => tc.name),
      });

      // Execute tool calls
      for (const toolCall of lastMessage.toolCalls) {
        logger.debug('Executing tool call', {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
        });
        const result = await executeToolCall(toolCall, sqlDb, logger);
        messages.push({
          role: 'tool',
          content: result,
          toolCallId: toolCall.id,
        });
      }
    } else {
      // No tool calls - check if this looks like a complete SQL script
      const content = lastMessage.content ?? '';
      const hasSqlStatements =
        /CREATE\s+(OR\s+REPLACE\s+)?VIEW/i.test(content) ||
        /CREATE\s+TABLE/i.test(content) ||
        /SELECT/i.test(content);

      // Check if LLM is giving explanations instead of using tools
      const isExplanatoryResponse =
        content.includes('I would need') ||
        content.includes("I don't have") ||
        content.includes('cannot access') ||
        content.includes('as an AI') ||
        content.includes('However, I can') ||
        (content.includes('example') && !hasSqlStatements);

      if (isExplanatoryResponse && iteration < 2) {
        // LLM is explaining instead of using tools - be very direct
        logger.warn('LLM giving explanatory response instead of using tools', {
          iteration: iteration + 1,
        });
        messages.push({
          role: 'user',
          content:
            'Stop explaining. Use the query_database tool immediately. Call it with: query_database({"query": "SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN (\'input_0\', \'target_0\') ORDER BY table_name, ordinal_position"})',
        });
      } else if (hasSqlStatements && content.trim().length > 50 && iteration > 0) {
        // Looks like a complete script after some iterations, return it
        logger.debug('Script generation completed (no tool calls needed)', {
          iteration: iteration + 1,
          scriptLength: content.length,
        });
        return content;
      } else if (iteration === 0) {
        // First iteration without tools - strongly encourage tool usage
        logger.debug(
          'LLM responded without tool calls on first iteration, strongly encouraging tool usage',
        );
        messages.push({
          role: 'user',
          content:
            "You MUST use the query_database tool to inspect the table schemas. I cannot proceed without knowing the actual column names and data types. Please call query_database with queries like: \"SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('input_0', 'target_0') ORDER BY table_name, ordinal_position\" to see the schemas.",
        });
      } else if (iteration === 1) {
        // Second iteration without tools - be even more direct
        logger.debug('LLM still not using tools on second iteration, being more directive');
        messages.push({
          role: 'user',
          content:
            'You need to use the query_database tool NOW. Do not explain or give examples. Call the tool with a SELECT query to inspect the tables. Start with: query_database({"query": "SELECT * FROM input_0 LIMIT 1"})',
        });
      } else {
        // On later iterations, if no tool calls and no SQL, assume we're done
        logger.debug('No tool calls and no SQL detected, assuming completion', {
          iteration: iteration + 1,
          contentLength: content.length,
        });
        return content;
      }
    }

    iteration++;
  }

  logger.warn('Reached maximum iterations', {
    maxIterations: MAX_ITERATIONS,
  });

  // If we've exhausted iterations, return the last message content
  const lastMessage = messages[messages.length - 1];
  if (lastMessage && lastMessage.role === 'assistant') {
    logger.debug('Returning script from last iteration', {
      scriptLength: lastMessage.content?.length ?? 0,
    });
    return lastMessage.content ?? '';
  }

  logger.error('No valid script generated after all iterations');
  return '';
}

/**
 * Executes a tool call and returns the result as a JSON string
 */
async function executeToolCall(toolCall: ToolCall, sqlDb: SqlDb, logger: Logger): Promise<string> {
  if (toolCall.name !== 'query_database') {
    logger.warn('Unknown tool call', { toolName: toolCall.name });
    return JSON.stringify({ error: 'Unknown tool' });
  }

  try {
    const params = queryDatabaseSchema.parse(toolCall.arguments);
    const query = params.query.trim();

    logger.debug('Executing database query', {
      toolCallId: toolCall.id,
      queryLength: query.length,
      queryPreview: query.substring(0, 100),
    });

    // Determine if this is a SELECT query (returns rows) or a command (modifies data)
    const queryUpper = query.toUpperCase().trim();
    const isSelectQuery =
      queryUpper.startsWith('SELECT') ||
      queryUpper.startsWith('WITH') ||
      queryUpper.startsWith('VALUES');

    if (isSelectQuery) {
      // Use query() for SELECT queries that return rows
      logger.debug('Executing SELECT query', { toolCallId: toolCall.id });
      const result = await sqlDb.query(query);

      if (isErr(result)) {
        logger.error('Query execution failed', {
          toolCallId: toolCall.id,
          error: result.error,
        });
        return JSON.stringify({ error: result.error });
      }

      logger.debug('Query executed successfully', {
        toolCallId: toolCall.id,
        rowCount: result.value.length,
      });

      return JSON.stringify({
        rows: result.value,
        rowCount: result.value.length,
      });
    } else {
      // Use execute() for INSERT, UPDATE, DELETE, DDL, etc.
      logger.debug('Executing command query', {
        toolCallId: toolCall.id,
        queryType: queryUpper.split(' ')[0],
      });
      const result = await sqlDb.execute(query);

      if (isErr(result)) {
        logger.error('Command execution failed', {
          toolCallId: toolCall.id,
          error: result.error,
        });
        return JSON.stringify({ error: result.error });
      }

      logger.debug('Command executed successfully', {
        toolCallId: toolCall.id,
        rowCount: result.value.rowCount,
      });

      return JSON.stringify({
        rowCount: result.value.rowCount,
        message: 'Query executed successfully',
      });
    }
  } catch (error) {
    logger.error('Tool call execution error', {
      toolCallId: toolCall.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
