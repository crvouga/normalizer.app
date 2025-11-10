import { useI18n } from '~/src/i18n/use-i18n';
import { Modal } from '../modal';
import { Button } from '../button';

interface ToastErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorDetails: string;
}

export function ToastErrorModal({ isOpen, onClose, errorDetails }: ToastErrorModalProps) {
  const { t } = useI18n();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('toast.errorDetails')} size="lg">
      <div className="space-y-4">
        <div className="max-h-96 overflow-auto rounded-lg bg-slate-50 p-4 dark:bg-slate-900">
          <pre className="font-mono text-xs wrap-break-word whitespace-pre-wrap text-slate-800 dark:text-slate-200">
            {errorDetails}
          </pre>
        </div>

        <div className="flex justify-end">
          <Button text={t('modal.close')} onClick={onClose} variant="outline" />
        </div>
      </div>
    </Modal>
  );
}
