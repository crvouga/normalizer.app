export function extractQueryFromToolArguments(argumentsValue: unknown): string | undefined {
  if (
    typeof argumentsValue !== 'object' ||
    argumentsValue === null ||
    !('query' in argumentsValue)
  ) {
    return undefined;
  }

  const query = argumentsValue.query;
  return typeof query === 'string' ? query : undefined;
}
