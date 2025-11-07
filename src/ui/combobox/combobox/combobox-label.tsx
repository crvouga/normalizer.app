export interface ComboboxLabelProps {
  label?: string;
}

/**
 * Displays the optional label above the combobox input.
 */
export function ComboboxLabel({ label }: ComboboxLabelProps) {
  if (!label) {
    return null;
  }

  return <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>;
}

