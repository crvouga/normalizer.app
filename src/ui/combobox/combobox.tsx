import { Combobox as HeadlessCombobox } from '@headlessui/react';
import * as React from 'react';
import { cn } from '~/src/lib/cn';
import { useI18n } from '../../i18n/use-i18n';
import type { ComboboxProps } from './combobox-types';
import { ComboboxEmptyState } from './combobox/combobox-empty-state';
import { ComboboxErrorState } from './combobox/combobox-error-state';
import { ComboboxInputField } from './combobox/combobox-input-field';
import { ComboboxLabel } from './combobox/combobox-label';
import { ComboboxOptionsContent } from './combobox/combobox-options-content';
import { ComboboxOptionsWrapper } from './combobox/combobox-options-wrapper';
import { useComboboxDisplayValue } from './combobox/use-combobox-display-value';
import { useComboboxFiltering } from './combobox/use-combobox-filtering';
import { useComboboxQuery } from './combobox/use-combobox-query';

// Re-export types for backward compatibility
export type { ComboboxOption, ComboboxProps } from './combobox-types';

export function Combobox<T extends string | number>({
  value,
  onChange,
  options,
  query: controlledQuery,
  onQueryChange,
  placeholder,
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
  actionButton,
}: ComboboxProps<T>) {
  const { t } = useI18n();
  const defaultPlaceholder = placeholder ?? t('common.search');

  // Use extracted hooks
  const { query, setQuery } = useComboboxQuery({
    ...(controlledQuery !== undefined ? { controlledQuery } : {}),
    ...(onQueryChange !== undefined ? { onQueryChange } : {}),
  });

  const { getDisplayValue } = useComboboxDisplayValue({
    options,
    ...(displayValue !== undefined ? { displayValue } : {}),
  });

  const { filteredOptions } = useComboboxFiltering({
    options,
    query,
    ...(filterOptions !== undefined ? { filterOptions } : {}),
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
      {label && <ComboboxLabel label={label} />}
      <div className="flex">
        <div className="flex-1">
          <HeadlessCombobox value={value} onChange={onChange} disabled={disabled}>
            <ComboboxInputField
              displayValue={getDisplayValue}
              onQueryChange={setQuery}
              placeholder={defaultPlaceholder}
              isLoading={isLoading}
              hasError={hasError}
              {...(inputClassName !== undefined ? { inputClassName } : {})}
              hasActionButton={Boolean(actionButton)}
            />

            <ComboboxOptionsWrapper
              {...(optionsClassName !== undefined ? { optionsClassName } : {})}
            >
              <ComboboxOptionsContent
                error={error}
                filteredOptions={filteredOptions}
                isLoading={isLoading}
                {...(renderOption !== undefined ? { renderOption } : {})}
                renderEmptyState={renderEmptyState}
                renderErrorState={renderErrorState}
                {...(renderFooter !== undefined ? { renderFooter } : {})}
              />
            </ComboboxOptionsWrapper>
          </HeadlessCombobox>
        </div>
        {actionButton && <div className="h-full shrink-0">{actionButton}</div>}
      </div>
    </div>
  );
}
