/**
 * Generates the user prompt for normalization view creation
 */
export function createUserPrompt(): string {
  return `
Please follow these steps to create the normalization views:

1. Use the \`query_database\` tool with SELECT queries to thoroughly inspect **both** the schemas **and** the actual data values in the input and target tables.
2. Strive to understand the semantic meaning and relationships of each field, and determine how the input data should be transformed to conform to the target schema—not just by column names or types, but by the *meaning* of the data.
3. For each output view, construct SQL (using CREATE OR REPLACE VIEW, or other constructs such as materialized views, tables, or indexes if needed) that performs the correct semantic transformation of the input data to match the target schema.

You **must** create all required output views before considering your work finished.
  `.trim();
}
