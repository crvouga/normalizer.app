import { AlertCircle } from 'lucide-react';
import { Typography } from '../../typography';
import { toI18nText } from '../../../i18n/types';

export interface ComboboxErrorStateProps {
  error: Error | string;
}

/**
 * Displays an error state for the combobox.
 * Shows an alert icon and error message.
 * Supports dark mode with lighter error color.
 */
export function ComboboxErrorState({ error }: ComboboxErrorStateProps) {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <div className="flex items-center gap-2 px-4 py-8">
      <AlertCircle />
      <Typography variant="sm" color="error" text={toI18nText(errorMessage)} />
    </div>
  );
}
