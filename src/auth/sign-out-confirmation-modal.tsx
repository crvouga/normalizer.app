import { Modal } from '~/src/ui/modal';
import { ModalActions } from '~/src/ui/modal-actions';
import { Typography } from '~/src/ui/typography';
import { useI18n } from '~/src/i18n/use-i18n';

type SignOutConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoggingOut: boolean;
};

/**
 * Confirmation modal for logout action
 */
export function SignOutConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isLoggingOut,
}: SignOutConfirmationModalProps) {
  const { t } = useI18n();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('auth.signOutConfirmTitle')} size="sm">
      <div className="space-y-4">
        <Typography variant="base" color="secondary">
          {t('auth.signOutConfirmMessage')}
        </Typography>

        <ModalActions
          cancelText={t('common.cancel')}
          onCancel={onClose}
          cancelDisabled={isLoggingOut}
          submitText={t('auth.signOut')}
          onSubmit={onConfirm}
          submitDisabled={isLoggingOut}
          submitType="button"
        />
      </div>
    </Modal>
  );
}
