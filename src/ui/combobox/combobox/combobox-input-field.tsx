import { ComboboxButton, ComboboxInput } from '@headlessui/react';
import { cn } from '~/src/lib/cn';
import type { I18nText } from '../../../i18n/types';
import { ChevronDown } from 'lucide-react';
import { Spinner } from '../../spinner';
import { getButtonBaseStyles } from '../../button-base';

export interface ComboboxInputFieldProps<T> {
  displayValue: (value: T | null) => string;
  onQueryChange: (value: string) => void;
  placeholder: I18nText;
  isLoading: boolean;
  hasError: boolean;
  inputClassName?: string;
  hasActionButton?: boolean;
}

/**
 * Input field for the combobox with loading indicator and dropdown button.
 * Handles text input and displays current value.
 * Supports dark mode with appropriate colors.
 * Opens dropdown on focus similar to MUI Autocomplete.
 */
export function ComboboxInputField<T extends string | number>({
  displayValue,
  onQueryChange,
  placeholder,
  isLoading,
  hasError,
  inputClassName,
  hasActionButton = false,
}: ComboboxInputFieldProps<T>) {
  return (
    <div className="relative">
      <ComboboxInput
        className={cn(
          'w-full border border-slate-300 bg-white py-3 pr-12 pl-4 text-lg leading-6 text-slate-900',
          'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
          'focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 focus:outline-none',
          'dark:focus:border-fuchsia-400 dark:focus:ring-fuchsia-400',
          'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
          'dark:disabled:bg-slate-900 dark:disabled:text-slate-600',
          hasError && 'border-red-500 focus:border-red-500 focus:ring-red-500',
          hasError && 'dark:border-red-400 dark:focus:border-red-400 dark:focus:ring-red-400',
          'placeholder:text-slate-400 dark:placeholder:text-slate-500',
          hasActionButton ? 'rounded-l-lg border-r-0' : 'rounded-lg',
          inputClassName,
        )}
        displayValue={displayValue}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />

      <ComboboxButton
        className={cn(getButtonBaseStyles(), 'absolute inset-y-0 right-0 flex items-center pr-3')}
      >
        {isLoading ? (
          <Spinner size="sm" />
        ) : (
          <ChevronDown className="origin-center text-slate-400 transition-transform duration-200 data-open:rotate-180 dark:text-slate-500" />
        )}
      </ComboboxButton>
    </div>
  );
}
