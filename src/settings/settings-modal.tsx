import { Modal } from '~/src/ui/modal';
import { ThemeRadioGroup } from '../ui/theme/theme-radio-group';
import { useI18n } from '../i18n/use-i18n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t } = useI18n();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('settings.title')} size="md">
      <div className="space-y-6">
        <ThemeRadioGroup />
      </div>
    </Modal>
  );
}
