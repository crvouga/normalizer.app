import * as React from 'react';
import { cn } from '~/src/lib/cn';

export interface ButtonBaseProps extends React.ComponentProps<'button'> {
  busy?: boolean;
}

/**
 * ButtonBase component with shared button styles for cursor states and opacity transitions.
 *
 * - cursor-pointer when enabled
 * - cursor-not-allowed when disabled
 * - cursor-wait when busy
 * - hover:opacity-90 when enabled
 * - active:opacity-80 when enabled
 */
export const ButtonBase = React.forwardRef<HTMLButtonElement, ButtonBaseProps>(
  ({ className, busy = false, disabled, children, ...props }, ref) => {
    const isDisabled = disabled || busy;

    return (
      <button
        ref={ref}
        className={cn(
          'transition-opacity',
          // Cursor states
          !isDisabled && 'cursor-pointer',
          disabled && 'cursor-not-allowed',
          busy && 'cursor-wait',
          // Opacity effects when enabled
          !isDisabled && 'hover:opacity-90 active:opacity-80',
          className,
        )}
        disabled={isDisabled}
        {...props}
      >
        {children}
      </button>
    );
  },
);

ButtonBase.displayName = 'ButtonBase';
