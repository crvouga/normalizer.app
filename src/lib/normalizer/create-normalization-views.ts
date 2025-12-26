import { AgenticLoop } from '../llm/agentic-loop';
import type { LLM } from '../llm/llm';
import type { Logger } from '../logger';
import { Err, isErr, Ok, type Result } from '../result';
import type { SqlDb } from '../sql-db/sql-db';
import { createQueryDatabaseTool } from './create-query-database-tool';

/**
 * Create normalization views that transform input tables to match target schemas both structurally and semantically.
 * The views must correctly map input data values to target schema values, not just match column names.
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

  const agentLoop = new AgenticLoop({ llm, logger });

  const ran = await agentLoop.run({
    tools: [queryDatabaseTool],
    goal: {
      description:
        'Create normalization views that transform input tables to match target schemas both structurally AND semantically. The views must correctly map input data values to target schema values, not just match column names.',
    },
    initialMessages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content:
          'First, use the query_database tool with SELECT queries to inspect both the schemas AND actual data values in the input and target tables. Understand the semantic meaning of each field and how input data should be transformed to match the target schema. Then create the output views (or materialized views, tables, indexes, etc. as needed) that correctly transform the input data semantically, not just structurally.',
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
  return `You are a PostgreSQL expert. Create database objects (views, materialized views, tables, indexes, etc.) that transform input tables to match target table schemas BOTH STRUCTURALLY AND SEMANTICALLY.

CRITICAL: This is not just about matching column names - you must understand the SEMANTIC MEANING of the data and correctly transform input values to match the target schema's expected values.

Tables:
- Inputs: ${inputTableNames.join(', ')}
- Targets: ${targetTableNames.join(', ')} (define desired schemas AND example data)
- Outputs: ${outputViewNames.join(', ')} (views/objects to create)

CRITICAL WORKFLOW:
1. First, inspect the ACTUAL column names AND SAMPLE DATA VALUES in the input tables using: SELECT * FROM ${inputTableNames[0]} LIMIT 10; or query information_schema.columns
2. Then, inspect the ACTUAL column names AND SAMPLE DATA VALUES in the target tables using the same approach
3. Understand the SEMANTIC MEANING of each field:
   - What does each input column represent?
   - What does each target column represent?
   - How should input values be transformed to match target values?
4. Create views that SELECT from input tables using the ACTUAL column names (which PostgreSQL converts to lowercase if unquoted), and ALIAS them to match the target schema exactly
5. Apply necessary transformations to ensure data values match semantically:
   - Combine fields (e.g., first_name + last_name → full_name)
   - Split fields (e.g., full_name → first_name, last_name)
   - Transform formats (e.g., date formats, phone number formats, case transformations)
   - Map values (e.g., status codes, category names)
   - Calculate derived values (e.g., totals, percentages)
   - Handle NULLs appropriately
   - Preserve data integrity and meaning

IMPORTANT COLUMN NAME HANDLING:
- PostgreSQL converts unquoted identifiers to lowercase. When you query input tables, the column names will be lowercase (e.g., "description", "instructor_email")
- You MUST use the actual lowercase column names from the input table in your SELECT statements
- You MUST use double quotes around ALL column aliases in the SELECT to preserve their case exactly as they appear in the target table
- Example: SELECT description AS "CourseDescription", instructor_email AS "CourseInstructorEmail" FROM input_0;
- DO NOT try to select from input tables using capitalized column names - they don't exist! Always use the actual lowercase names.

SEMANTIC MATCHING REQUIREMENTS:
- Inspect actual data values in both input and target tables to understand the expected format and meaning
- Map input columns to target columns based on SEMANTIC EQUIVALENCE, not just name similarity
- Transform data values correctly (e.g., if target expects "PROCESSING" but input has "processing", use UPPER() or appropriate transformation)
- Handle composite fields (e.g., if input has "subject" and "number" separately but target has "id" combining them, concatenate appropriately)
- Preserve the semantic meaning of the data - don't just copy values blindly
- Verify your transformations by comparing sample output data with target table data

Use the query_database tool to inspect actual schemas AND DATA VALUES with SELECT queries. Then create the necessary database objects directly using CREATE statements executed via the query_database tool. You may need to create:
- Regular views (CREATE OR REPLACE VIEW)
- Materialized views (CREATE MATERIALIZED VIEW) if performance requires it
- Temporary tables (CREATE TEMP TABLE) if intermediate transformations are needed
- Indexes (CREATE INDEX) if needed for performance
- Any other database objects required for the transformation

Map input columns to target columns intelligently based on semantic meaning (handle naming variations, type conversions, value transformations, NULLs, and data composition/decomposition as needed).

Create all necessary database objects directly in the database using the query_database tool.`;
}
