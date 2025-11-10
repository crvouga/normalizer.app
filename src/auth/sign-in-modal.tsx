import { Modal } from '~/src/ui/modal';
import { Button } from '~/src/ui/button';
import { Typography } from '~/src/ui/typography';
import { IconGoogle } from '~/src/ui/icons';
import { useI18n } from '~/src/i18n/use-i18n';

type SignInModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onGoogleSignIn: () => void;
};

/**
 * Modal that displays available sign-in options
 */
export function SignInModal({ isOpen, onClose, onGoogleSignIn }: SignInModalProps) {
  const { t } = useI18n();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('auth.signInTitle')} size="sm">
      <div className="space-y-6">
        <Typography variant="base" color="secondary">
          {t('auth.signInMessage')}
        </Typography>

        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={onGoogleSignIn}
            text={t('auth.signInWithGoogle')}
            startIcon={<IconGoogle className="size-5" />}
            className="w-full"
          />
        </div>
      </div>
    </Modal>
  );
}
