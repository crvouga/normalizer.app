import { useI18n } from '~/src/i18n/use-i18n';
import { Modal } from './modal';
import { Button } from './button';

interface ErrorDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: Error;
}

/**
 * Modal component for displaying full error details.
 * Shows error message and stack trace in a scrollable pre-formatted section.
 */
export function ErrorDetailsModal({ isOpen, onClose, error }: ErrorDetailsModalProps) {
  const { t } = useI18n();

  const errorDetails = error.stack || error.message;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('errorSection.errorDetails')} size="lg">
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
