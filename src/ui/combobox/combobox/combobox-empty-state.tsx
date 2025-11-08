import { Typography } from '../../typography';

export interface ComboboxEmptyStateProps {
  query: string;
}

/**
 * Displays an empty state when no options are available.
 * Shows different messages depending on whether a query is present.
 * Supports dark mode with lighter text color.
 */
export function ComboboxEmptyState({ query }: ComboboxEmptyStateProps) {
  return (
    <div className="px-4 py-8 text-center">
      <Typography variant="sm" color="muted">
        {query ? `No results found for "${query}"` : 'No options available'}
      </Typography>
    </div>
  );
}
