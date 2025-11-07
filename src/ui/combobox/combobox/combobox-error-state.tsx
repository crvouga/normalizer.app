import { IconAlertCircle } from '../../icons';

export interface ComboboxErrorStateProps {
  error: Error | string;
}

/**
 * Displays an error state for the combobox.
 * Shows an alert icon and error message.
 */
export function ComboboxErrorState({ error }: ComboboxErrorStateProps) {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <div className="flex items-center gap-2 px-4 py-8 text-sm text-red-600">
      <IconAlertCircle />
      <span>{errorMessage}</span>
    </div>
  );
}
