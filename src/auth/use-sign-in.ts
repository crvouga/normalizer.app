import { useState, useCallback } from 'react';

/**
 * Hook for handling sign-in flow with modal
 * Returns functions to control the sign-in modal
 */
export function useSignIn() {
  const [isOpen, setIsOpen] = useState(false);

  const openSignInDialog = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSignInDialog = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleGoogleSignIn = useCallback(() => {
    // Redirect to Google OAuth
    window.location.href = '/api/auth/google';
  }, []);

  return {
    isOpen,
    openSignInDialog,
    closeSignInDialog,
    handleGoogleSignIn,
  };
}
