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
        'w-full border border-slate-300 bg-white px-4 py-3 text-lg leading-6 text-slate-900',
        'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
        'focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 focus:outline-none',
        'dark:focus:border-fuchsia-400 dark:focus:ring-fuchsia-400',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
        'dark:disabled:bg-slate-900 dark:disabled:text-slate-600',
        hasError && 'border-red-500 focus:border-red-500 focus:ring-red-500',
        hasError && 'dark:border-red-400 dark:focus:border-red-400 dark:focus:ring-red-400',
        'placeholder:text-slate-400 dark:placeholder:text-slate-500',
        'rounded-lg',
        inputClassName,
        className,
      )}
      autoComplete="off"
      {...props}
    />
  );
}
