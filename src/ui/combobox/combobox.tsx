import {
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Combobox as HeadlessCombobox,
} from '@headlessui/react';
import * as React from 'react';
import { cn } from '~/src/lib/utils';
import { IconAlertCircle, IconCheck, IconChevronDown, IconSpinner } from '../icons';

// Types
export interface ComboboxOption<T> {
  value: T;
  label: string;
  disabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ComboboxProps<T> {
  // Value management
  value: T | null;
  onChange: (value: T | null) => void;

  // Options
  options: ComboboxOption<T>[];

  // Query state (controlled)
  query?: string;
  onQueryChange?: (query: string) => void;

  // Customization
  placeholder?: string;
  displayValue?: (value: T | null) => string;
  filterOptions?: (options: ComboboxOption<T>[], query: string) => ComboboxOption<T>[];
  renderOption?: (option: ComboboxOption<T>, selected: boolean) => React.ReactNode;
  renderEmpty?: (query: string) => React.ReactNode;
  renderError?: (error: Error) => React.ReactNode;
  renderFooter?: () => React.ReactNode;

  // Loading state
  isLoading?: boolean;
  error?: Error | string | null;

  // Behavior
  disabled?: boolean;

  // Styling
  className?: string;
  inputClassName?: string;
  optionsClassName?: string;

  // Labels
  label?: string;
  helperText?: string;
}

export function Combobox<T extends string | number>({
  value,
  onChange,
  options,
  query: controlledQuery,
  onQueryChange,
  placeholder = 'Search...',
  displayValue,
  filterOptions,
  renderOption,
  renderEmpty,
  renderError,
  renderFooter,
  isLoading = false,
  error: errorProp,
  disabled = false,
  className,
  inputClassName,
  optionsClassName,
  label,
  helperText,
}: ComboboxProps<T>) {
  // State for uncontrolled query
  const [internalQuery, setInternalQuery] = React.useState('');

  // Use controlled query if provided, otherwise use internal state
  const query = controlledQuery !== undefined ? controlledQuery : internalQuery;
  const setQuery = (newQuery: string) => {
    if (onQueryChange) {
      onQueryChange(newQuery);
    } else {
      setInternalQuery(newQuery);
    }
  };

  // Display value function
  const getDisplayValue = React.useCallback(
    (val: T | null) => {
      if (val === null) return '';
      if (displayValue) return displayValue(val);

      const option = options.find((opt) => opt.value === val);
      return option?.label || String(val);
    },
    [displayValue, options],
  );

  // Filter options if provided
  const filteredOptions = React.useMemo(() => {
    if (filterOptions && query) {
      return filterOptions(options, query);
    }
    return options;
  }, [options, query, filterOptions]);

  // Render option content
  const renderOptionContent = React.useCallback(
    (option: ComboboxOption<T>, selected: boolean) => {
      if (renderOption) {
        return renderOption(option, selected);
      }

      return (
        <div className="flex items-center justify-between">
          <span className={cn('truncate', selected && 'font-semibold')}>{option.label}</span>
          {selected && <IconCheck className="text-blue-600" />}
        </div>
      );
    },
    [renderOption],
  );

  // Render empty state
  const renderEmptyState = React.useCallback(() => {
    if (renderEmpty) {
      return renderEmpty(query);
    }

    return (
      <div className="px-4 py-8 text-center text-sm text-gray-500">
        {query ? `No results found for "${query}"` : 'No options available'}
      </div>
    );
  }, [renderEmpty, query]);

  // Render error state
  const renderErrorState = React.useCallback(
    (err: Error | string) => {
      if (renderError) {
        return renderError(err instanceof Error ? err : new Error(err));
      }

      const errorMessage = err instanceof Error ? err.message : err;

      return (
        <div className="flex items-center gap-2 px-4 py-8 text-sm text-red-600">
          <IconAlertCircle />
          <span>{errorMessage}</span>
        </div>
      );
    },
    [renderError],
  );

  // Convert error prop to Error object if needed
  const error = errorProp
    ? errorProp instanceof Error
      ? errorProp
      : new Error(String(errorProp))
    : null;

  // Determine if there's an error to show in the input border
  const hasError = Boolean(error);

  return (
    <div className={cn('w-full', className)}>
      {label && <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>}

      <HeadlessCombobox value={value} onChange={onChange} disabled={disabled}>
        <div className="relative">
          <div className="relative">
            <ComboboxInput
              className={cn(
                'w-full rounded-lg border border-gray-300 bg-white py-2 pr-10 pl-3 text-sm leading-5 text-gray-900',
                'focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none',
                'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
                hasError && 'border-red-500 focus:border-red-500 focus:ring-red-500',
                inputClassName,
              )}
              displayValue={getDisplayValue}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
            />

            <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
              {isLoading ? (
                <IconSpinner className="text-gray-400" />
              ) : (
                <IconChevronDown className="text-gray-400" />
              )}
            </ComboboxButton>
          </div>

          <ComboboxOptions
            className={cn(
              'ring-opacity-5 absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black focus:outline-none sm:text-sm',
              optionsClassName,
            )}
          >
            {error ? (
              renderErrorState(error)
            ) : filteredOptions.length === 0 && !isLoading ? (
              renderEmptyState()
            ) : (
              <>
                {filteredOptions.map((option) => (
                  <ComboboxOption
                    key={String(option.value)}
                    value={option.value}
                    disabled={option.disabled}
                    className={({ focus, selected }) =>
                      cn(
                        'relative cursor-pointer py-2 pr-9 pl-3 select-none',
                        focus && 'bg-blue-50',
                        selected && 'bg-blue-100',
                        option.disabled && 'cursor-not-allowed opacity-50',
                      )
                    }
                  >
                    {({ selected }) => <>{renderOptionContent(option, selected)}</>}
                  </ComboboxOption>
                ))}

                {/* Optional footer for custom content like "load more" */}
                {renderFooter && renderFooter()}
              </>
            )}
          </ComboboxOptions>
        </div>
      </HeadlessCombobox>

      {/* Helper text or error message */}
      {(helperText || error) && (
        <p className={cn('mt-1 text-xs', error ? 'text-red-600' : 'text-gray-500')}>
          {error ? (error instanceof Error ? error.message : String(error)) : helperText}
        </p>
      )}
    </div>
  );
}
