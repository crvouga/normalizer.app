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
    <p className="mt-1 text-xs text-gray-500">
      {total} {total === 1 ? 'result' : 'results'}
    </p>
  );
}
