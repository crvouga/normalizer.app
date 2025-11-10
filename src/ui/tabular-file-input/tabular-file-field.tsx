import * as React from 'react';
import { cn } from '~/src/lib/cn';
import { Label } from '../label';
import { TabularFileInput, type TabularFileInputProps } from './tabular-file-input';

export interface TabularFileFieldProps extends TabularFileInputProps {
  label?: string;
}

/**
 * A tabular file input field component that includes a label.
 * Wraps TabularFileInput with a Label component for consistency with other form fields.
 */
export const TabularFileField = React.forwardRef<HTMLInputElement, TabularFileFieldProps>(
  ({ label, className, ...props }, ref) => {
    return (
      <div className={cn('w-full', className)}>
        {label && <Label className="mb-2 block">{label}</Label>}
        <TabularFileInput ref={ref} {...props} />
      </div>
    );
  },
);

TabularFileField.displayName = 'TabularFileField';
