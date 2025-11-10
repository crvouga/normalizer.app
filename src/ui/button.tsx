import * as React from 'react';
import { cn } from '~/src/lib/cn';
import { IconSpinner } from './icons';
import { ButtonBase } from './button-base';

type ButtonVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link'
  | 'contained'
  | 'gradient';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';
type ButtonColor = 'purple' | 'red' | 'green' | 'yellow' | 'gray';

function getButtonClasses(
  variant: ButtonVariant = 'default',
  size: ButtonSize = 'default',
  color: ButtonColor = 'purple',
) {
  const baseClasses = [
    'inline-flex items-center justify-center gap-2',
    'whitespace-nowrap rounded-md text-base font-medium',
    'transition-[color,box-shadow]',
    'disabled:pointer-events-none disabled:opacity-50',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
    'ring-ring/10 dark:ring-ring/20',
    'dark:outline-ring/40 outline-ring/50',
    // Make the focus-visible rings much less pronounced:
    // Reduce ring width and outline thickness, and tone down ring color strength
    'focus-visible:ring-2 focus-visible:outline-[0.5px] focus-visible:ring-ring/10 dark:focus-visible:ring-ring/20',
    'aria-invalid:focus-visible:ring-0',
    // Note: cursor-pointer and active:opacity-80 are now provided by ButtonBase
  ].join(' ');

  const colorClasses = {
    purple:
      'bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 text-white shadow-md hover:shadow-lg hover:from-purple-600 hover:via-purple-700 hover:to-purple-800 dark:from-purple-600 dark:via-purple-700 dark:to-purple-800 dark:hover:from-purple-700 dark:hover:via-purple-800 dark:hover:to-purple-900',
    red: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
    green: 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600',
    yellow:
      'bg-yellow-600 text-white hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600',
    gray: 'bg-gray-600 text-white hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600',
  } as const;

  const variantClasses = {
    default: colorClasses[color],
    destructive: 'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
    outline:
      'border border-input/40 bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
    contained:
      'bg-white dark:bg-gray-800 text-black dark:text-white shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700',
  };

  const sizeClasses = {
    default: 'h-11 px-5 py-2.5 has-[>svg]:px-4',
    sm: 'h-10 rounded-md px-4 has-[>svg]:px-3.5',
    lg: 'h-12 rounded-md px-7 has-[>svg]:px-5',
    icon: 'size-11',
  };

  return `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`;
}

interface ButtonProps extends Omit<React.ComponentProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  color?: ButtonColor;
  asChild?: boolean;
  text?: string;
  startIcon?: React.ReactNode;
  loading?: boolean;
}

function Button({
  className,
  variant = 'default',
  size = 'default',
  color = 'purple',
  asChild = false,
  text,
  startIcon,
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <ButtonBase
      data-slot="button"
      className={cn(getButtonClasses(variant, size, color), 'relative', className)}
      disabled={disabled}
      busy={loading}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <IconSpinner />
        </span>
      )}
      <span className={cn('inline-flex items-center justify-center gap-2', loading && 'opacity-0')}>
        {startIcon}
        {text}
      </span>
    </ButtonBase>
  );
}

export { Button };
