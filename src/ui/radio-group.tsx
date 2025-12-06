import { Description, RadioGroup as HeadlessRadioGroup, Label, Radio } from '@headlessui/react';
import { cn } from '~/src/lib/cn';
import type { I18nText } from '../i18n/types';
import { Check } from 'lucide-react';
import { type Icon } from './icons';
import { Typography } from './typography';

export interface RadioOption<T extends string = string> {
  value: T;
  label: I18nText;
  description?: I18nText;
  disabled?: boolean;
  icon?: Icon;
}

export interface RadioGroupProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: RadioOption<T>[];
  label?: I18nText;
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
          text={label}
        />
      )}

      <HeadlessRadioGroup value={value} onChange={onChange}>
        <div className="space-y-2">
          {options.map((option) => (
            <Radio
              key={option.value}
              value={option.value}
              {...(option.disabled !== undefined ? { disabled: option.disabled } : {})}
              className={({ checked, disabled }) =>
                cn(
                  'relative flex cursor-pointer rounded-lg border px-4 py-3 transition-colors',
                  checked
                    ? 'border-fuchsia-500 bg-fuchsia-50 dark:border-fuchsia-400 dark:bg-fuchsia-950'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700',
                  disabled && 'cursor-not-allowed opacity-50',
                )
              }
            >
              {({ checked }) => (
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-3">
                    {option.icon && (
                      <option.icon
                        className={cn(
                          'size-6 shrink-0',
                          checked
                            ? 'text-fuchsia-600 dark:text-fuchsia-400'
                            : 'text-slate-500 dark:text-slate-400',
                        )}
                      />
                    )}
                    <div className="flex flex-col">
                      <Label
                        as="span"
                        className={cn(
                          'text-base font-medium',
                          checked
                            ? 'text-fuchsia-900 dark:text-fuchsia-100'
                            : 'text-slate-900 dark:text-slate-100',
                        )}
                      >
                        {option.label}
                      </Label>
                      {option.description && (
                        <Description
                          as="span"
                          className={cn(
                            'text-sm',
                            checked
                              ? 'text-fuchsia-700 dark:text-fuchsia-300'
                              : 'text-slate-600 dark:text-slate-400',
                          )}
                        >
                          {option.description}
                        </Description>
                      )}
                    </div>
                  </div>
                  {checked && (
                    <div className="shrink-0">
                      <Check className="size-5 text-fuchsia-600 dark:text-fuchsia-400" />
                    </div>
                  )}
                </div>
              )}
            </Radio>
          ))}
        </div>
      </HeadlessRadioGroup>
    </div>
  );
}
