import type { I18nText } from '../../../i18n/types';
import { Typography } from '../../typography';

export interface ComboboxLabelProps {
  label?: I18nText;
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
    <Typography as="label" variant="base" weight="medium" color="secondary" className="mb-2 block">
      {label}
    </Typography>
  );
}
