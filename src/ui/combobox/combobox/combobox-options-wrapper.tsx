import { ComboboxOptions } from '@headlessui/react';
import * as React from 'react';
import { cn } from '~/src/lib/cn';
import { getSurfaceStyles } from '~/src/ui/surface';

export interface ComboboxOptionsWrapperProps {
  optionsClassName?: string;
  children: React.ReactNode;
}

/**
 * Surface styles for combobox/select dropdowns.
 * Includes max height and scrolling behavior.
 */
function getComboboxSurfaceStyles(className?: string) {
  return cn(getSurfaceStyles(), 'max-h-60 overflow-auto', className);
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
      className={getComboboxSurfaceStyles(cn('mt-1 w-(--input-width) text-base', optionsClassName))}
    >
      {children}
    </ComboboxOptions>
  );
}
