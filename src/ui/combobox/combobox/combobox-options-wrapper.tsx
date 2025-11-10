import { ComboboxOptions } from '@headlessui/react';
import * as React from 'react';
import { cn } from '~/src/lib/cn';

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
      anchor="bottom start"
      className={cn(
        'ring-opacity-5 z-50 mt-1 max-h-60 w-(--input-width) overflow-auto rounded-lg bg-white text-base shadow-lg ring-1 ring-black focus:outline-none',
        'dark:bg-slate-800 dark:ring-slate-700',
        optionsClassName,
      )}
    >
      {children}
    </ComboboxOptions>
  );
}
