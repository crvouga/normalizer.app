import { ComboboxOption as HeadlessComboboxOption } from '@headlessui/react';
import * as React from 'react';
import { cn } from '~/src/lib/utils';
import { IconCheck } from '../../icons';
import type { ComboboxOption } from '../combobox';

export interface ComboboxOptionItemProps<T> {
  option: ComboboxOption<T>;
  renderOption?: (option: ComboboxOption<T>, selected: boolean) => React.ReactNode;
}

/**
 * Individual option item in the combobox dropdown.
 * Handles rendering, selection state, and disabled state.
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
        <span className={cn('truncate', selected && 'font-semibold')}>{option.label}</span>
        {selected && <IconCheck className="text-blue-600" />}
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
          'relative cursor-pointer py-2 pr-9 pl-3 select-none',
          focus && 'bg-blue-50',
          selected && 'bg-blue-100',
          option.disabled && 'cursor-not-allowed opacity-50',
        )
      }
    >
      {({ selected }) => <>{renderContent(selected)}</>}
    </HeadlessComboboxOption>
  );
}
