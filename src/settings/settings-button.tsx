import { useState } from 'react';
import { SettingsModal } from './settings-modal';
import { Settings } from 'lucide-react';
import { ButtonBase } from '~/src/ui/button-base';

export function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <ButtonBase
        onClick={() => setIsOpen(true)}
        className="rounded p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="Settings"
        title="Settings"
      >
        <Settings className="size-5" />
      </ButtonBase>

      <SettingsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
