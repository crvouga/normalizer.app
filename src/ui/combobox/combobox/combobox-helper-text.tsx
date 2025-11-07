import { cn } from '~/src/lib/utils';

export interface ComboboxHelperTextProps {
  helperText?: string;
  error?: Error | string | null;
}

/**
 * Displays helper text or error message below the combobox.
 * Error messages take priority over helper text.
 */
export function ComboboxHelperText({ helperText, error }: ComboboxHelperTextProps) {
  if (!helperText && !error) {
    return null;
  }

  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : String(error)
    : null;

  return (
    <p className={cn('mt-1 text-xs', error ? 'text-red-600' : 'text-gray-500')}>
      {errorMessage || helperText}
    </p>
  );
}

