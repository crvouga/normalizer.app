import * as React from 'react';
import { cn } from '~/src/lib/cn';
import type { I18nText } from '~/src/i18n/types';

type TypographyVariant = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';
type TypographyColor =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'disabled'
  | 'error'
  | 'success'
  | 'info'
  | 'warning'
  | 'fuchsia';
type TypographyWeight = 'normal' | 'medium' | 'semibold' | 'bold';
type TypographyElement = 'p' | 'span' | 'div' | 'label' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

interface TypographyProps {
  variant?: TypographyVariant;
  color?: TypographyColor;
  weight?: TypographyWeight;
  as?: TypographyElement;
  className?: string;
  text: I18nText;
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
  primary: 'text-slate-900 dark:text-slate-100',
  secondary: 'text-slate-700 dark:text-slate-200',
  muted: 'text-slate-600 dark:text-slate-400',
  disabled: 'text-slate-500 dark:text-slate-500',
  error: 'text-red-600 dark:text-red-400',
  success: 'text-green-600 dark:text-green-400',
  info: 'text-fuchsia-600 dark:text-fuchsia-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  fuchsia: 'text-fuchsia-500 dark:text-fuchsia-400',
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
  text,
  ...props
}: PolymorphicProps<E>) {
  const Component = (as || 'p') as React.ElementType;

  return (
    <Component
      className={cn(variantClasses[variant], colorClasses[color], weightClasses[weight], className)}
      {...(props as any)}
    >
      {text}
    </Component>
  );
}
