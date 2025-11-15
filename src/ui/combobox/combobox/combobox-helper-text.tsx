import type { I18nText } from '../../../i18n/types';
import { toI18nText } from '../../../i18n/types';
import { Typography } from '../../typography';

export interface ComboboxHelperTextProps {
  helperText?: I18nText;
  error?: Error | string | null;
}

/**
 * Displays helper text or error message below the combobox.
 * Error messages take priority over helper text.
 * Supports dark mode with lighter text colors.
 */
export function ComboboxHelperText({ helperText, error }: ComboboxHelperTextProps) {
  if (!helperText && !error) {
    return null;
  }

  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;

  return (
    <Typography
      variant="xs"
      color={error ? 'error' : 'muted'}
      className="mt-1"
      text={errorMessage ? toI18nText(errorMessage) : helperText!}
    />
  );
}
