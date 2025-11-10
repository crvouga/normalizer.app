import { ComboboxOption as HeadlessComboboxOption } from '@headlessui/react';
import * as React from 'react';
import { cn } from '~/src/lib/cn';
import { IconCheck } from '../../icons';
import type { ComboboxOption } from '../combobox';

export interface ComboboxOptionItemProps<T> {
  option: ComboboxOption<T>;
  renderOption?: (option: ComboboxOption<T>, selected: boolean) => React.ReactNode;
}

/**
 * Individual option item in the combobox dropdown.
 * Handles rendering, selection state, and disabled state.
 * Supports dark mode with appropriate hover and selection colors.
 */
export function ComboboxOptionItem<T extends string | number>({
  option,
  renderOption,
}: ComboboxOptionItemProps<T>) {
  const renderContent = (selected: boolean) => {
    if (renderOption) {
      return renderOption(option, selected);
    }

    return (
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'truncate text-lg text-slate-900 dark:text-slate-100',
            selected && 'font-semibold',
          )}
        >
          {option.label}
        </span>
        {selected && <IconCheck className="size-5 text-purple-600 dark:text-purple-400" />}
      </div>
    );
  };

  return (
    <HeadlessComboboxOption
      key={String(option.value)}
      value={option.value}
      disabled={option.disabled}
      className={({ focus, selected }) =>
        cn(
          'relative cursor-pointer py-3 pr-10 pl-4 select-none',
          focus && 'bg-purple-50 dark:bg-slate-700',
          selected && 'bg-purple-100 dark:bg-slate-600',
          option.disabled && 'cursor-not-allowed opacity-50',
        )
      }
    >
      {({ selected }) => <>{renderContent(selected)}</>}
    </HeadlessComboboxOption>
  );
}
