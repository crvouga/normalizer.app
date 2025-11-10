import * as React from 'react';
import { cn } from '~/src/lib/cn';

export interface TextFieldInputProps extends React.ComponentProps<'input'> {
  hasError?: boolean;
  inputClassName?: string;
}

/**
 * Input field for the text field.
 * Matches the styling of ComboboxInputField without the dropdown button.
 * Supports dark mode with appropriate colors.
 */
export function TextFieldInput({
  hasError = false,
  inputClassName,
  className,
  ...props
}: TextFieldInputProps) {
  return (
    <input
      className={cn(
        'w-full border border-gray-300 bg-white px-4 py-3 text-lg leading-6 text-gray-900',
        'dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100',
        'focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none',
        'dark:focus:border-blue-400 dark:focus:ring-blue-400',
        'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
        'dark:disabled:bg-gray-900 dark:disabled:text-gray-600',
        hasError && 'border-red-500 focus:border-red-500 focus:ring-red-500',
        hasError && 'dark:border-red-400 dark:focus:border-red-400 dark:focus:ring-red-400',
        'placeholder:text-gray-400 dark:placeholder:text-gray-500',
        'rounded-lg',
        inputClassName,
        className,
      )}
      autoComplete="off"
      {...props}
    />
  );
}
