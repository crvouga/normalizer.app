import * as React from 'react';
import { Button } from '~/src/ui/button';
import { cn } from '~/src/lib/cn';

export interface ComboboxActionButtonProps {
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'contained';
  startIcon?: React.ReactNode;
  text: string;
  className?: string;
}

/**
 * Action button designed to be used with Combobox components.
 * Styled to visually connect with the combobox input field.
 */
export function ComboboxActionButton({
  onClick,
  disabled = false,
  variant = 'outline',
  startIcon,
  text,
  className,
}: ComboboxActionButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      variant={variant}
      size="default"
      startIcon={startIcon}
      text={text}
      className={cn(
        'h-[50px] rounded-l-none rounded-r-lg border border-l-0 border-transparent px-4 py-3 whitespace-nowrap',
        'border border-gray-300',
        'dark:border-gray-600',
        className,
      )}
    />
  );
}
