import * as React from 'react';

import { cn } from '~/src/lib/utils';
import { Typography } from './typography';

function Label({ className, color, ...props }: React.ComponentProps<'label'>) {
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
      {...(props as any)}
    />
  );
}

export { Label };
