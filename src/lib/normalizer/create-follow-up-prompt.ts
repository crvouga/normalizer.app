/**
 * Generates the follow-up prompt when an output view does not exist yet
 */
export function createFollowUpPrompt(params: {
  outputViewName: string;
  lastSqlError?: string;
}): string {
  const errorSection = params.lastSqlError
    ? `
Your last SQL statement failed with:
${params.lastSqlError}

Query information_schema.columns and SELECT sample rows before retrying. Only reference columns that exist in the input tables.
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
