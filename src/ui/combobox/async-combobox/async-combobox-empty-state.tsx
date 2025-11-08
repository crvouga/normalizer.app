import { Typography } from '../../typography';

export interface AsyncComboboxEmptyStateProps {
  query: string;
  minQueryLength: number;
}

/**
 * Empty state component for async combobox.
 * Shows a message when the query is too short.
 */
export function AsyncComboboxEmptyState({ query, minQueryLength }: AsyncComboboxEmptyStateProps) {
  if (query.length < minQueryLength) {
    return (
      <Typography variant="sm" color="muted" className="p-4">
        Type at least {minQueryLength} character{minQueryLength !== 1 ? 's' : ''} to search
      </Typography>
    );
  }

  return (
    <Typography variant="sm" color="muted" className="p-4">
      No results found for "{query}"
    </Typography>
  );
}
