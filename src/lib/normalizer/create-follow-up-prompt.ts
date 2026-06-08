/**
 * Generates the follow-up prompt when an output view does not exist yet
 */
function isViewColumnTypeError(error: string): boolean {
  return error.toLowerCase().includes('cannot change data type of view column');
}

export function createFollowUpPrompt(params: {
  outputViewName: string;
  lastSqlError?: string;
}): string {
  const errorSection = params.lastSqlError
    ? `
Your last SQL statement failed with:
${params.lastSqlError}

Query information_schema.columns and SELECT sample rows before retrying. Only reference columns that exist in the input tables.
${
  isViewColumnTypeError(params.lastSqlError)
    ? `
PostgreSQL cannot change column types with CREATE OR REPLACE VIEW. Drop the view first, then recreate with explicit casts:

  DROP VIEW IF EXISTS "${params.outputViewName}" CASCADE;
  CREATE VIEW "${params.outputViewName}" AS
    SELECT ... , column_name::numeric AS "NumericColumn", column_name::text AS "TextColumn" ...
`
    : ''
}
`
    : '';

  return `
The output view "${params.outputViewName}" has not been created yet.
${errorSection}
Please ensure that you create it using a statement such as:

  CREATE OR REPLACE VIEW "${params.outputViewName}" AS ...

Remember to use the \`query_database\` tool to help you construct the correct view. 
You must create this output view before your work is considered complete.
  `.trim();
}
