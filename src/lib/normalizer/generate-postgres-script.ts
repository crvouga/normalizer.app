import type { LLM } from '../llm/llm';

export async function generatePostgresScript({
  inputs,
  targets,
  outputs,
  llm,
}: {
  inputs: Array<{ viewName: string }>;
  targets: Array<{ viewName: string }>;
  outputs: Array<{ viewName: string }>;
  llm: LLM;
}): Promise<string> {
  const inputTableNames = inputs.map((input) => input.viewName).join(', ');
  const targetTableNames = targets.map((target) => target.viewName).join(', ');
  const outputViewNames = outputs.map((output) => output.viewName).join(', ');

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

Generate precise, executable PostgreSQL code that transforms the input data to perfectly match the target schema.`;

  const response = await llm.completions([
    {
      role: 'system',
      content: systemPrompt,
    },
  ]);

  return response[response.length - 1]?.content ?? '';
}
