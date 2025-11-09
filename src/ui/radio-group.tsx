import { RadioGroup as HeadlessRadioGroup } from '@headlessui/react';
import { cn } from '~/src/lib/cn';
import { IconCheck } from './icons';
import { Typography } from './typography';

export interface RadioOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: RadioOption<T>[];
  label?: string;
  className?: string;
}

/**
 * Reusable radio group component with proper styling for light/dark modes.
 * Uses HeadlessUI RadioGroup for accessibility.
 */
export function RadioGroup<T extends string = string>({
  value,
  onChange,
  options,
  label,
  className,
}: RadioGroupProps<T>) {
  return (
    <div className={className}>
      {label && (
        <Typography
          as="label"
          variant="sm"
          weight="semibold"
          color="primary"
          className="mb-3 block"
        >
          {label}
        </Typography>
      )}

      <HeadlessRadioGroup value={value} onChange={onChange}>
        <div className="space-y-2">
          {options.map((option) => (
            <HeadlessRadioGroup.Option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className={({ checked, disabled }) =>
                cn(
                  'relative flex cursor-pointer rounded-lg border px-4 py-3 transition-colors',
                  checked
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950'
                    : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700',
                  disabled && 'cursor-not-allowed opacity-50',
                )
              }
            >
              {({ checked }) => (
                <div className="flex w-full items-center justify-between">
                  <div className="flex flex-col">
                    <HeadlessRadioGroup.Label
                      as="span"
                      className={cn(
                        'text-base font-medium',
                        checked
                          ? 'text-blue-900 dark:text-blue-100'
                          : 'text-gray-900 dark:text-gray-100',
                      )}
                    >
                      {option.label}
                    </HeadlessRadioGroup.Label>
                    {option.description && (
                      <HeadlessRadioGroup.Description
                        as="span"
                        className={cn(
                          'text-sm',
                          checked
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-gray-600 dark:text-gray-400',
                        )}
                      >
                        {option.description}
                      </HeadlessRadioGroup.Description>
                    )}
                  </div>
                  {checked && (
                    <div className="shrink-0">
                      <IconCheck className="size-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                </div>
              )}
            </HeadlessRadioGroup.Option>
          ))}
        </div>
      </HeadlessRadioGroup>
    </div>
  );
}
