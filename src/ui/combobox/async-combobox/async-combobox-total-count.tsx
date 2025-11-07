import { Typography } from '../../typography';

export interface AsyncComboboxTotalCountProps {
  total?: number;
  hasError: boolean;
  isLoading: boolean;
}

/**
 * Displays the total count of results for async combobox.
 * Only shows when total is available and there are no errors or loading states.
 */
export function AsyncComboboxTotalCount({
  total,
  hasError,
  isLoading,
}: AsyncComboboxTotalCountProps) {
  if (total === undefined || hasError || isLoading) {
    return null;
  }

  return (
    <Typography variant="xs" color="muted" className="mt-1">
      {total} {total === 1 ? 'result' : 'results'}
    </Typography>
  );
}
