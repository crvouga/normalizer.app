import { Combobox as HeadlessCombobox } from '@headlessui/react';
import * as React from 'react';
import { cn } from '~/src/lib/utils';
import { ComboboxEmptyState } from './combobox/combobox-empty-state';
import { ComboboxErrorState } from './combobox/combobox-error-state';
import { ComboboxHelperText } from './combobox/combobox-helper-text';
import { ComboboxInputField } from './combobox/combobox-input-field';
import { ComboboxLabel } from './combobox/combobox-label';
import { ComboboxOptionsContent } from './combobox/combobox-options-content';
import { ComboboxOptionsWrapper } from './combobox/combobox-options-wrapper';
import { useComboboxDisplayValue } from './combobox/use-combobox-display-value';
import { useComboboxFiltering } from './combobox/use-combobox-filtering';
import { useComboboxQuery } from './combobox/use-combobox-query';

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

  // Action button
  actionButton?: React.ReactNode;
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
  actionButton,
}: ComboboxProps<T>) {
  // Use extracted hooks
  const { query, setQuery } = useComboboxQuery({
    controlledQuery,
    onQueryChange,
  });

  const { getDisplayValue } = useComboboxDisplayValue({
    options,
    displayValue,
  });

  const { filteredOptions } = useComboboxFiltering({
    options,
    query,
    filterOptions,
  });

  // Render empty state
  const renderEmptyState = React.useCallback(() => {
    if (renderEmpty) {
      return renderEmpty(query);
    }

    return <ComboboxEmptyState query={query} />;
  }, [renderEmpty, query]);

  // Render error state
  const renderErrorState = React.useCallback(
    (err: Error | string) => {
      if (renderError) {
        return renderError(err instanceof Error ? err : new Error(err));
      }

      return <ComboboxErrorState error={err} />;
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
      <ComboboxLabel label={label} />
      <div className="flex">
        <div className="flex-1">
          <HeadlessCombobox value={value} onChange={onChange} disabled={disabled}>
            <div className="relative">
              <ComboboxInputField
                displayValue={getDisplayValue}
                onQueryChange={setQuery}
                placeholder={placeholder}
                isLoading={isLoading}
                hasError={hasError}
                inputClassName={inputClassName}
                hasActionButton={Boolean(actionButton)}
              />

              <ComboboxOptionsWrapper optionsClassName={optionsClassName}>
                <ComboboxOptionsContent
                  error={error}
                  filteredOptions={filteredOptions}
                  isLoading={isLoading}
                  renderOption={renderOption}
                  renderEmptyState={renderEmptyState}
                  renderErrorState={renderErrorState}
                  renderFooter={renderFooter}
                />
              </ComboboxOptionsWrapper>
            </div>
          </HeadlessCombobox>
        </div>
        {actionButton && <div className="h-full shrink-0">{actionButton}</div>}
      </div>
    </div>
  );
}
