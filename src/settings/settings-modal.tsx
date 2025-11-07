import { Modal } from '~/src/ui/modal';
import { ThemeRadioGroup } from '../ui/theme/theme-radio-group';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" size="md">
      <div className="space-y-6">
        <ThemeRadioGroup />
      </div>
    </Modal>
  );
}
