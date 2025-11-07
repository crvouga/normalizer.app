import { useState } from 'react';
import { SettingsModal } from './settings-modal';
import { IconSettings } from '~/src/ui/icons';

export function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded p-2 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        aria-label="Settings"
        title="Settings"
      >
        <IconSettings className="size-5" />
      </button>

      <SettingsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
