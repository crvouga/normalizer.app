import * as React from 'react';
import type { ComboboxOption } from '../combobox-types';
import { ComboboxOptionItem } from './combobox-option-item';

export interface ComboboxOptionsContentProps<T> {
  error: Error | null;
  filteredOptions: ComboboxOption<T>[];
  isLoading: boolean;
  renderOption?: (option: ComboboxOption<T>, selected: boolean) => React.ReactNode;
  renderEmptyState: () => React.ReactNode;
  renderErrorState: (error: Error | string) => React.ReactNode;
  renderFooter?: () => React.ReactNode;
}

/**
 * Renders the content inside the combobox dropdown.
 * Handles three main states: error, empty, and options list.
 */
export function ComboboxOptionsContent<T extends string | number>({
  error,
  filteredOptions,
  isLoading,
  renderOption,
  renderEmptyState,
  renderErrorState,
  renderFooter,
}: ComboboxOptionsContentProps<T>) {
  // Error state takes highest priority
  if (error) {
    return <div className="py-1">{renderErrorState(error)}</div>;
  }

  // Show empty state when no options and not loading
  const hasNoOptions = filteredOptions.length === 0;
  if (hasNoOptions && !isLoading) {
    return <div className="py-1">{renderEmptyState()}</div>;
  }

  // Show options list
  return (
    <>
      {filteredOptions.map((option) => (
        <ComboboxOptionItem
          key={String(option.value)}
          option={option}
          {...(renderOption !== undefined ? { renderOption } : {})}
        />
      ))}

      {/* Optional footer for custom content like "load more" */}
      {renderFooter && renderFooter()}
    </>
  );
}
