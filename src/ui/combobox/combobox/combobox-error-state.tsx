import { IconAlertCircle } from '../../icons';
import { Typography } from '../../typography';

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
      <IconAlertCircle />
      <Typography variant="sm" color="error">
        {errorMessage}
      </Typography>
    </div>
  );
}
