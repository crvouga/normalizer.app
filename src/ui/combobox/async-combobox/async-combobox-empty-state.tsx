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
      <div className="px-4 py-8 text-center text-sm text-gray-500">
        Type at least {minQueryLength} character{minQueryLength !== 1 ? 's' : ''} to search
      </div>
    );
  }

  return null; // Use default from base Combobox
}
