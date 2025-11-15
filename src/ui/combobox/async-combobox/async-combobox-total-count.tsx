import { Typography } from '../../typography';
import { toI18nText } from '../../../i18n/types';

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
    <Typography
      variant="xs"
      color="muted"
      className="mt-1 min-h-[1.25rem]"
      text={
        shouldShowCount
          ? toI18nText(`${total} ${total === 1 ? 'result' : 'results'}`)
          : toI18nText('\u00A0')
      }
    />
  );
}
