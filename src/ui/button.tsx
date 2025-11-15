import * as React from 'react';
import { cn } from '~/src/lib/cn';
import type { I18nText } from '../i18n/types';
import { ButtonBase } from './button-base';
import { Spinner, type SpinnerColor } from './spinner';

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
type ButtonColor = 'fuchsia' | 'red' | 'green' | 'yellow' | 'gray';

function getButtonClasses(
  variant: ButtonVariant = 'default',
  size: ButtonSize = 'default',
  color: ButtonColor = 'fuchsia',
) {
  const baseClasses = [
    'inline-flex items-center justify-center gap-2',
    'whitespace-nowrap rounded-md text-base font-medium',
    'transition-[color,box-shadow]',
    'disabled:pointer-events-none disabled:opacity-50',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
    'ring-ring/10 dark:ring-ring/20',
    'dark:outline-ring/40 outline-ring/50',
    'focus-visible:ring-2 focus-visible:outline-[0.5px] focus-visible:ring-ring/10 dark:focus-visible:ring-ring/20',
    'aria-invalid:focus-visible:ring-0',
  ].join(' ');

  const colorClasses = {
    fuchsia:
      'bg-gradient-to-br from-fuchsia-500 via-fuchsia-600 to-fuchsia-700 text-white shadow-md hover:shadow-lg hover:from-fuchsia-600 hover:via-fuchsia-700 hover:to-fuchsia-800 dark:from-fuchsia-600 dark:via-fuchsia-700 dark:to-fuchsia-800 dark:hover:from-fuchsia-700 dark:hover:via-fuchsia-800 dark:hover:to-fuchsia-900',
    red: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
    green: 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600',
    yellow:
      'bg-yellow-600 text-white hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600',
    gray: 'bg-slate-600 text-white hover:bg-slate-700 dark:bg-slate-500 dark:hover:bg-slate-600',
  } as const;

  const variantClasses = {
    default: colorClasses[color],
    destructive: 'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
    outline:
      'border border-slate-500 bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
    contained:
      'bg-white dark:bg-slate-800 text-black dark:text-white shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700',
    gradient: colorClasses[color],
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
  text?: I18nText;
  startIcon?: React.ReactNode;
  loading?: boolean;
}

function Button({
  className,
  variant = 'default',
  size = 'default',
  color = 'fuchsia',
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
          <Spinner size="sm" color={getSpinnerColor(variant)} />
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

function getSpinnerColor(variant: ButtonVariant): SpinnerColor {
  switch (variant) {
    case 'default':
    case 'destructive':
    case 'gradient':
      return 'white';
    case 'outline':
    case 'ghost':
    case 'link':
    case 'contained':
      return 'fuchsia';
    case 'secondary':
      return 'white';
  }
}
