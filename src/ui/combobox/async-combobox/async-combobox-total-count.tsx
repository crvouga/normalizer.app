import { Typography } from '../../typography';

export interface AsyncComboboxTotalCountProps {
  total?: number;
  hasError: boolean;
  isLoading: boolean;
}

/**
 * Displays the total count of results for async combobox.
 * Always reserves space to prevent layout shift.
 * Only shows content when total is available and there are no errors or loading states.
 */
export function AsyncComboboxTotalCount({
  total,
  hasError,
  isLoading,
}: AsyncComboboxTotalCountProps) {
  const shouldShowCount = total !== undefined && !hasError && !isLoading;

  return (
    <Typography variant="xs" color="muted" className="mt-1 min-h-[1.25rem]">
      {shouldShowCount ? `${total} ${total === 1 ? 'result' : 'results'}` : '\u00A0'}
    </Typography>
  );
}
