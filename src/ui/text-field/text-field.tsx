import * as React from 'react';
import { cn } from '~/src/lib/cn';
import { TextFieldInput } from './text-field-input';
import { TextFieldLabel } from './text-field-label';

export interface TextFieldProps extends Omit<React.ComponentProps<'input'>, 'className'> {
  // Label
  label?: string;

  // Error state
  error?: Error | string | null;
  hasError?: boolean;

  // Styling
  className?: string;
  inputClassName?: string;
}

/**
 * A text field component that matches the styling of the Combobox component.
 * Combines a label and an input field with consistent styling.
 */
export function TextField({
  label,
  error: errorProp,
  hasError: hasErrorProp,
  className,
  inputClassName,
  id,
  ...inputProps
}: TextFieldProps) {
  // Determine if there's an error to show in the input border
  const hasError = hasErrorProp ?? Boolean(errorProp);

  return (
    <div className={cn('w-full', className)}>
      <TextFieldLabel label={label} htmlFor={id} />
      <TextFieldInput id={id} hasError={hasError} inputClassName={inputClassName} {...inputProps} />
    </div>
  );
}
