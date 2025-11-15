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

  const handleClose = () => {
    if (!isLoggingOut) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('auth.signOutConfirmTitle')}
      size="sm"
      disabled={isLoggingOut}
    >
      <div className="space-y-4">
        <Typography variant="base" color="secondary" text={t('auth.signOutConfirmMessage')} />

        <ModalActions
          cancelText={t('common.cancel')}
          onCancel={handleClose}
          cancelDisabled={isLoggingOut}
          submitText={t('auth.signOut')}
          onSubmit={onConfirm}
          submitLoading={isLoggingOut}
          submitType="button"
        />
      </div>
    </Modal>
  );
}
