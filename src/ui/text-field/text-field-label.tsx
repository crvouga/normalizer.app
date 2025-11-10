import { Typography } from '../typography';

export interface TextFieldLabelProps {
  label?: string;
  htmlFor?: string;
}

/**
 * Displays the optional label above the text field input.
 * Matches the styling of ComboboxLabel.
 * Supports dark mode with lighter text color.
 */
export function TextFieldLabel({ label, htmlFor }: TextFieldLabelProps) {
  if (!label) {
    return null;
  }

  return (
    <Typography
      as="label"
      variant="base"
      weight="medium"
      color="secondary"
      className="mb-2 block"
      {...(htmlFor ? { htmlFor } : {})}
    >
      {label}
    </Typography>
  );
}
