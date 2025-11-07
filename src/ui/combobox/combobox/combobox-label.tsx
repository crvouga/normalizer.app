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

  return <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>;
}

