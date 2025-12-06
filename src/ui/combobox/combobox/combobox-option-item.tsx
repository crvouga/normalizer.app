import { ComboboxOption as HeadlessComboboxOption } from '@headlessui/react';
import * as React from 'react';
import { cn } from '~/src/lib/cn';
import { Check } from 'lucide-react';
import type { ComboboxOption } from '../combobox-types';

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
        {selected && <Check className="size-5 text-fuchsia-600 dark:text-fuchsia-400" />}
      </div>
    );
  };

  return (
    <HeadlessComboboxOption
      key={String(option.value)}
      value={option.value}
      {...(option.disabled !== undefined ? { disabled: option.disabled } : {})}
      className={({ focus, selected }) =>
        cn(
          'relative cursor-pointer py-3 pr-10 pl-4 select-none',
          'transition-colors',
          // Hover state - visible background change
          'hover:bg-slate-100 dark:hover:bg-slate-600',
          // Keyboard focus state - more visible than hover, uses data attribute from HeadlessUI
          focus && 'bg-fuchsia-50 dark:bg-slate-500',
          // Selected state - distinct background
          selected && 'bg-fuchsia-100 dark:bg-slate-500',
          // Selected + focus combination - keep the stronger selected state
          selected && focus && 'bg-fuchsia-200 dark:bg-slate-500',
          option.disabled && 'cursor-not-allowed opacity-50',
        )
      }
    >
      {({ selected }) => <>{renderContent(selected)}</>}
    </HeadlessComboboxOption>
  );
}
