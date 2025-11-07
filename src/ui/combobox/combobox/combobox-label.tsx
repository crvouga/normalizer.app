import { Typography } from '../../typography';

export interface ComboboxLabelProps {
  label?: string;
}

/**
 * Displays the optional label above the combobox input.
 * Supports dark mode with lighter text color.
 */
export function ComboboxLabel({ label }: ComboboxLabelProps) {
  if (!label) {
    return null;
  }

  return (
    <Typography as="label" variant="sm" weight="medium" color="secondary" className="mb-2 block">
      {label}
    </Typography>
  );
}
