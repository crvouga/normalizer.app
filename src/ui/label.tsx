import * as React from 'react';

import { cn } from '~/src/lib/utils';

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'text-sm leading-none font-medium text-gray-900 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:text-gray-100',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
