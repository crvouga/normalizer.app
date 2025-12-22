import { z } from 'zod';
import type { LLM, Message, ToolCall, ToolDefinition } from '../llm/llm';
import type { Logger } from '../logger';
import { isErr } from '../result';
import type { SqlDb } from '../sql-db/sql-db';

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
  // msgBus: MsgBus;
}): Promise<{
  explanation: string;
  postgresScript: string | null;
}> {
  logger.debug('Starting PostgreSQL script generation', {
    inputCount: inputs.length,
    targetCount: targets.length,
    outputCount: outputs.length,
  });

  const inputTableNames = inputs.map((input) => input.viewName);
  const targetTableNames = targets.map((target) => target.viewName);
  const outputViewNames = outputs.map((output) => output.viewName);

  // Define the query_database tool
  const queryDatabaseTool: ToolDefinition = {
    name: 'query_database',
    description:
      'Execute any SQL query against the PostgreSQL database. Can be used to inspect table schemas, column names, data types, sample data, create tables, insert data, or perform any other database operations. Examples: "SELECT * FROM input_0 LIMIT 5", "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'input_0\'", "CREATE TABLE test AS SELECT * FROM input_0"',
    parameters: queryDatabaseSchema,
  };

  const systemPrompt = toSystemPrompt({
    inputTableNames,
    targetTableNames,
    outputViewNames,
  });

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
      // temperature: 0.0,
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
        // On later iterations, if no tool calls, proceed to Phase 2
        logger.debug('No tool calls detected, proceeding to structured output generation', {
          iteration: iteration + 1,
          contentLength: content.length,
        });
        break;
      }
    }

    iteration++;
  }

  if (iteration >= MAX_ITERATIONS) {
    logger.warn('Reached maximum iterations', {
      maxIterations: MAX_ITERATIONS,
    });
  }

  // Phase 2: Generate structured output
  logger.debug('Starting Phase 2: Structured JSON generation');
  messages.push({
    role: 'user',
    content:
      'Based on the database schemas you inspected, generate the PostgreSQL transformation script with an explanation. Return the result as structured JSON with "explanation" and "postgresScript" fields.',
  });

  type OutputType = z.infer<typeof postgresScriptOutputSchema>;
  for await (const chunk of llm.stream(messages, {
    schema: postgresScriptOutputSchema,
    //  temperature: 0.0,
  })) {
    if (chunk.type === 'done') {
      const data = chunk.data as OutputType;
      logger.debug('Structured output generation completed', {
        explanationLength: data.explanation.length,
        postgresScriptLength: data.postgresScript.length,
      });
      return data;
    }
  }

  logger.error('No valid structured output generated');
  return {
    explanation: 'Failed to generate structured output',
    postgresScript: null,
  };
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

    logger.debug('Executing database query (always uses unsafe)', {
      toolCallId: toolCall.id,
      queryLength: query.length,
      queryPreview: query.substring(0, 100),
    });

    // Always use sqlDb.unsafe() for all queries
    const result = await sqlDb.unsafe(query);

    if (isErr(result)) {
      logger.error('Query execution failed', {
        toolCallId: toolCall.id,
        error: result.error,
      });
      return JSON.stringify({ error: result.error });
    }

    const resultSummary =
      typeof result.value === 'object' && result.value !== null
        ? Array.isArray(result.value)
          ? { rowCount: result.value.length }
          : Object.keys(result.value)
        : typeof result.value;

    logger.debug('Query executed successfully', {
      toolCallId: toolCall.id,
      resultSummary,
    });

    // Try to guess kind of result for backward compatibility
    // If it's an array, it's likely SELECT; if it's an object with rowCount, DML; else generic
    if (Array.isArray(result.value)) {
      return JSON.stringify({
        rows: result.value,
        rowCount: result.value.length,
      });
    } else if (
      result.value &&
      typeof result.value === 'object' &&
      'rowCount' in result.value &&
      typeof result.value.rowCount === 'number'
    ) {
      return JSON.stringify({
        rowCount: result.value.rowCount,
        message: 'Query executed successfully',
      });
    } else {
      return JSON.stringify({
        result: result.value,
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

// Define the query_database tool schema
const queryDatabaseSchema = z.object({
  query: z
    .string()
    .describe(
      'A SQL query to execute against the database. Can be any valid PostgreSQL statement including SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, etc.',
    ),
});

// Define the structured output schema for PostgreSQL script generation
const postgresScriptOutputSchema = z.object({
  explanation: z
    .string()
    .describe('Explanation of how the transformation works and what mappings were applied'),
  postgresScript: z.string().describe('The complete PostgreSQL CREATE OR REPLACE VIEW statements'),
});

/**
 * Generates the system prompt for PostgreSQL script generation
 */
function toSystemPrompt(params: {
  inputTableNames: string[];
  targetTableNames: string[];
  outputViewNames: string[];
}): string {
  const { inputTableNames, targetTableNames, outputViewNames } = params;
  return `You are a PostgreSQL expert. Generate CREATE OR REPLACE VIEW statements that transform input tables to match target table schemas exactly.

Tables:
- Inputs: ${inputTableNames.join(', ')}
- Targets: ${targetTableNames.join(', ')} (define desired schemas)
- Outputs: ${outputViewNames.join(', ')} (views to create)

Use query_database to inspect actual schemas and data. Map input columns to target columns intelligently (handle naming variations, type conversions, NULLs as needed).

IMPORTANT: PostgreSQL converts unquoted identifiers to lowercase. You MUST use double quotes around ALL column aliases to preserve their case exactly as they appear in the target table. For example: SELECT col AS "MixedCaseColumn" (not AS MixedCaseColumn).

Output: Return ONLY valid PostgreSQL SQL statements. No markdown code fences, no explanatory text outside SQL comments.`;
}
