import { ComboboxOptions } from '@headlessui/react';
import * as React from 'react';
import { cn } from '~/src/lib/utils';

export interface ComboboxOptionsWrapperProps {
  optionsClassName?: string;
  children: React.ReactNode;
}

/**
 * Wrapper for the combobox dropdown options with default styling.
 * Provides consistent styling for the options container (positioning, shadow, scrolling, etc.)
 * Supports dark mode with appropriate background and border colors.
 */
export function ComboboxOptionsWrapper({
  optionsClassName,
  children,
}: ComboboxOptionsWrapperProps) {
  return (
    <ComboboxOptions
      className={cn(
        'ring-opacity-5 absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black focus:outline-none sm:text-sm',
        'dark:bg-gray-800 dark:ring-gray-700',
        optionsClassName,
      )}
    >
      {children}
    </ComboboxOptions>
  );
}
