import { ComboboxButton, ComboboxInput } from '@headlessui/react';
import { cn } from '~/src/lib/utils';
import { IconChevronDown, IconSpinner } from '../../icons';

export interface ComboboxInputFieldProps<T> {
  displayValue: (value: T | null) => string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  isLoading: boolean;
  hasError: boolean;
  inputClassName?: string;
}

/**
 * Input field for the combobox with loading indicator and dropdown button.
 * Handles text input and displays current value.
 * Supports dark mode with appropriate colors.
 */
export function ComboboxInputField<T extends string | number>({
  displayValue,
  onQueryChange,
  placeholder,
  isLoading,
  hasError,
  inputClassName,
}: ComboboxInputFieldProps<T>) {
  return (
    <div className="relative">
      <ComboboxInput
        className={cn(
          'w-full rounded-lg border border-gray-300 bg-white py-2 pr-10 pl-3 text-base leading-5 text-gray-900',
          'dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100',
          'focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none',
          'dark:focus:border-blue-400 dark:focus:ring-blue-400',
          'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
          'dark:disabled:bg-gray-900 dark:disabled:text-gray-600',
          hasError && 'border-red-500 focus:border-red-500 focus:ring-red-500',
          hasError && 'dark:border-red-400 dark:focus:border-red-400 dark:focus:ring-red-400',
          'placeholder:text-gray-400 dark:placeholder:text-gray-500',
          inputClassName,
        )}
        displayValue={displayValue}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
      />

      <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
        {isLoading ? (
          <IconSpinner className="text-gray-400 dark:text-gray-500" />
        ) : (
          <IconChevronDown className="text-gray-400 dark:text-gray-500" />
        )}
      </ComboboxButton>
    </div>
  );
}
