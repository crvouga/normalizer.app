import { Typography } from '../../typography';
import { toI18nText } from '../../../i18n/types';

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
      <Typography
        variant="sm"
        color="muted"
        className="p-4"
        text={toI18nText(
          `Type at least ${minQueryLength} character${minQueryLength !== 1 ? 's' : ''} to search`,
        )}
      />
    );
  }

  return (
    <Typography
      variant="sm"
      color="muted"
      className="p-4"
      text={toI18nText(`No results found for "${query}"`)}
    />
  );
}
