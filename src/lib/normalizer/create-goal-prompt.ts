/**
 * Generates the goal prompt for normalization view creation
 */
export function createGoalPrompt(): string {
  return [
    'Your task is to create normalization views for a database.',
    'These views should transform the input tables so they match the target schemas, both:',
    '  - Structurally (matching columns, types, formats, etc.)',
    '  - Semantically (values must be meaningfully mapped, not simply renamed)',
    '',
    "It's important that the views correctly convert or map input data values to the appropriate target schema values.",
    'Do not simply match or rename column names — ensure values are genuinely normalized and transformed if needed.',
  ].join('\n');
}
