import { RadioGroup } from '@headlessui/react';
import { Modal } from '~/src/ui/modal';
import { useTheme, type Theme } from '~/src/ui/theme/use-theme';
import { IconCheck } from '~/src/ui/icons';
import { cn } from '~/src/lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const themeOptions: { value: Theme; label: string; description: string }[] = [
  {
    value: 'system',
    label: 'System',
    description: 'Matches your system preference',
  },
  {
    value: 'light',
    label: 'Light',
    description: 'Light mode',
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Dark mode',
  },
];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" size="md">
      <div className="space-y-6">
        {/* Appearance Section */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Appearance
          </h3>

          <RadioGroup value={theme} onChange={setTheme}>
            <div className="space-y-2">
              {themeOptions.map((option) => (
                <RadioGroup.Option
                  key={option.value}
                  value={option.value}
                  className={({ checked }) =>
                    cn(
                      'relative flex cursor-pointer rounded-lg border px-4 py-3 transition-colors',
                      checked
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950'
                        : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700',
                    )
                  }
                >
                  {({ checked }) => (
                    <div className="flex w-full items-center justify-between">
                      <div className="flex flex-col">
                        <RadioGroup.Label
                          as="span"
                          className={cn(
                            'text-sm font-medium',
                            checked
                              ? 'text-blue-900 dark:text-blue-100'
                              : 'text-gray-900 dark:text-gray-100',
                          )}
                        >
                          {option.label}
                        </RadioGroup.Label>
                        <RadioGroup.Description
                          as="span"
                          className={cn(
                            'text-xs',
                            checked
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-gray-600 dark:text-gray-400',
                          )}
                        >
                          {option.description}
                        </RadioGroup.Description>
                      </div>
                      {checked && (
                        <div className="shrink-0">
                          <IconCheck className="size-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      )}
                    </div>
                  )}
                </RadioGroup.Option>
              ))}
            </div>
          </RadioGroup>
        </div>
      </div>
    </Modal>
  );
}
