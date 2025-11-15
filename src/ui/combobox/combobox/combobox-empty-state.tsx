import { Typography } from '../../typography';
import { useI18n } from '../../../i18n/use-i18n';

export interface ComboboxEmptyStateProps {
  query: string;
}

/**
 * Displays an empty state when no options are available.
 * Shows different messages depending on whether a query is present.
 * Supports dark mode with lighter text color.
 */
export function ComboboxEmptyState({ query }: ComboboxEmptyStateProps) {
  const { t } = useI18n();

  return (
    <div className="px-4 py-8 text-center">
      <Typography variant="sm" color="muted">
        {query ? t('combobox.noResultsFound', { query }) : t('combobox.noOptionsAvailable')}
      </Typography>
    </div>
  );
}
