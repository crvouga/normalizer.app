import { useState, useCallback } from 'react';
import { trpcClient } from '~/src/trpc-client';
import { useCurrentUser } from '~/src/users/use-current-user';
import { showSuccessToast, showErrorToast } from '~/src/ui/toast';
import { useI18n } from '~/src/i18n/use-i18n';

/**
 * Hook for handling user logout with confirmation dialog
 * Returns functions to control the logout flow
 */
export function useSignOut() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { refetchCurrentUser } = useCurrentUser();
  const { t } = useI18n();

  const openSignOutDialog = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSignOutDialog = useCallback(() => {
    setIsOpen(false);
  }, []);

  const confirmSignOut = useCallback(async () => {
    try {
      setIsSigningOut(true);

      // Call logout mutation
      await trpcClient.users.logout.mutate();

      // Refetch current user (will get new anonymous user)
      await refetchCurrentUser();

      // Show success message
      showSuccessToast(t('auth.signOutSuccess'));

      // Close the dialog
      closeSignOutDialog();
    } catch (error) {
      console.error('Logout failed:', error);
      showErrorToast('Failed to sign out', error);
    } finally {
      setIsSigningOut(false);
    }
  }, [refetchCurrentUser, t, closeSignOutDialog]);

  return {
    isOpen,
    isSigningOut,
    openSignOutDialog,
    closeSignOutDialog,
    confirmSignOut,
  };
}
