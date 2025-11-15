import * as React from 'react';

import { cn } from '~/src/lib/cn';
import { Typography } from './typography';
import { toI18nText } from '~/src/i18n/types';

function Label({ className, color, children, ...props }: React.ComponentProps<'label'>) {
  // If children is a string, convert to I18nText and use Typography
  // Otherwise, render children directly in a label element
  if (typeof children === 'string') {
    return (
      <Typography
        as="label"
        variant="sm"
        weight="medium"
        color="primary"
        className={cn(
          'leading-none select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
          className,
        )}
        data-slot="label"
        style={color ? { color } : undefined}
        text={toI18nText(children)}
        {...(props as any)}
      />
    );
  }

  // For non-string children, render in a label element without Typography
  return (
    <label
      className={cn(
        'text-sm leading-none font-medium text-slate-900 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:text-slate-100',
        className,
      )}
      data-slot="label"
      style={color ? { color } : undefined}
      {...props}
    >
      {children}
    </label>
  );
}

export { Label };
