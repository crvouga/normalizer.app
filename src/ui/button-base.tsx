import * as React from 'react';
import { cn } from '~/src/lib/cn';

export interface ButtonBaseProps extends React.ComponentProps<'button'> {
  busy?: boolean;
}

/**
 * Returns base button style classes for cursor states and opacity transitions.
 *
 * @param options - Configuration options
 * @param options.disabled - Whether the button is disabled
 * @param options.busy - Whether the button is in a busy/loading state
 */
export function getButtonBaseStyles({
  disabled = false,
  busy = false,
}: { disabled?: boolean; busy?: boolean } = {}) {
  const isDisabled = disabled || busy;

  return cn(
    'transition-opacity',
    // Purple outline on focus, rounded ring
    'focus:ring-rounded focus:ring-2 focus:ring-fuchsia-500 focus:outline-none',
    // Cursor states
    !isDisabled && 'cursor-pointer',
    disabled && 'cursor-not-allowed',
    busy && 'cursor-wait',
    // Opacity effects when enabled
    !isDisabled && 'hover:opacity-90 active:opacity-80',
  );
}

/**
 * ButtonBase component with shared button styles for cursor states and opacity transitions.
 *
 * - cursor-pointer when enabled
 * - cursor-not-allowed when disabled
 * - cursor-wait when busy
 * - hover:opacity-90 when enabled
 * - active:opacity-80 when enabled
 * - focus:ring-2 focus:ring-fuchsia-500 focus:outline-none for purple outline
 * - focus:ring-offset-0 focus-visible:ring-rounded for rounded focus ring
 */
export const ButtonBase = React.forwardRef<HTMLButtonElement, ButtonBaseProps>(
  ({ className, busy = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(getButtonBaseStyles({ disabled, busy }), className)}
        disabled={disabled || busy}
        {...props}
      >
        {children}
      </button>
    );
  },
);

ButtonBase.displayName = 'ButtonBase';
