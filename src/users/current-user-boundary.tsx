import { useEffect, type ReactNode } from 'react';
import { SplashScreen } from '../ui/splash-screen';
import { showErrorToast } from '../ui/toast';
import { useCurrentUser } from './use-current-user';

/**
 * Boundary component that handles loading and error states for the current user.
 * Shows a splash screen while loading and displays an error toast if loading fails.
 * Only renders children when the user is successfully loaded.
 */
export function CurrentUserBoundary({ children }: { children: ReactNode }) {
  const { currentUserResult } = useCurrentUser();

  useEffect(() => {
    if (currentUserResult.tag === 'err') {
      showErrorToast('Failed to load user', currentUserResult.error);
    }
  }, [currentUserResult]);

  if (
    currentUserResult.tag === 'loading' ||
    currentUserResult.tag === 'notAsked' ||
    currentUserResult.tag === 'err'
  ) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}
