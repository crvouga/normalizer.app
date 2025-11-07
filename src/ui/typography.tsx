import * as React from 'react';
import { cn } from '~/src/lib/utils';

type TypographyVariant = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';
type TypographyColor =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'disabled'
  | 'error'
  | 'success'
  | 'info'
  | 'warning';
type TypographyWeight = 'normal' | 'medium' | 'semibold' | 'bold';
type TypographyElement = 'p' | 'span' | 'div' | 'label' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

interface TypographyProps {
  variant?: TypographyVariant;
  color?: TypographyColor;
  weight?: TypographyWeight;
  as?: TypographyElement;
  className?: string;
  children?: React.ReactNode;
}

const variantClasses: Record<TypographyVariant, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
};

const colorClasses: Record<TypographyColor, string> = {
  primary: 'text-gray-900 dark:text-gray-100',
  secondary: 'text-gray-700 dark:text-gray-200',
  muted: 'text-gray-600 dark:text-gray-400',
  disabled: 'text-gray-500 dark:text-gray-500',
  error: 'text-red-600 dark:text-red-400',
  success: 'text-green-600 dark:text-green-400',
  info: 'text-blue-600 dark:text-blue-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
};

const weightClasses: Record<TypographyWeight, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

type PolymorphicProps<E extends TypographyElement> = TypographyProps &
  Omit<React.ComponentPropsWithoutRef<E>, keyof TypographyProps>;

export function Typography<E extends TypographyElement = 'p'>({
  variant = 'base',
  color = 'primary',
  weight = 'normal',
  as,
  className,
  children,
  ...props
}: PolymorphicProps<E>) {
  const Component = (as || 'p') as React.ElementType;

  return (
    <Component
      className={cn(variantClasses[variant], colorClasses[color], weightClasses[weight], className)}
      {...(props as any)}
    >
      {children}
    </Component>
  );
}
