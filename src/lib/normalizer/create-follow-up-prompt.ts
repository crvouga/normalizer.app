/**
 * Generates the follow-up prompt when an output view does not exist yet
 */
export function createFollowUpPrompt(params: { outputViewName: string }): string {
  return `
The output view "${params.outputViewName}" has not been created yet.

Please ensure that you create it using a statement such as:

  CREATE OR REPLACE VIEW "${params.outputViewName}" AS ...

Remember to use the \`query_database\` tool to help you construct the correct view. 
You must create this output view before your work is considered complete.
  `.trim();
}
