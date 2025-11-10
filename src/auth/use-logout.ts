import { useState, useCallback } from 'react';
import { trpcClient } from '~/src/trpc-client';
import { useCurrentUser } from '~/src/users/use-current-user';
import { showSuccessToast, showErrorToast } from '~/src/ui/toast';
import { useI18n } from '~/src/i18n/use-i18n';

/**
 * Hook for handling user logout with confirmation dialog
 * Returns functions to control the logout flow
 */
export function useLogout() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { refetchCurrentUser } = useCurrentUser();
  const { t } = useI18n();

  const openLogoutDialog = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeLogoutDialog = useCallback(() => {
    setIsOpen(false);
  }, []);

  const confirmLogout = useCallback(async () => {
    try {
      setIsLoggingOut(true);

      // Call logout mutation
      await trpcClient.users.logout.mutate();

      // Refetch current user (will get new anonymous user)
      await refetchCurrentUser();

      // Show success message
      showSuccessToast(t('auth.signOutSuccess'));

      // Close the dialog
      closeLogoutDialog();
    } catch (error) {
      console.error('Logout failed:', error);
      showErrorToast('Failed to sign out', error);
    } finally {
      setIsLoggingOut(false);
    }
  }, [refetchCurrentUser, t, closeLogoutDialog]);

  return {
    isOpen,
    isLoggingOut,
    openLogoutDialog,
    closeLogoutDialog,
    confirmLogout,
  };
}
