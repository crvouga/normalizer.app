import { useEffect, type ReactNode } from 'react';
import { SplashScreen } from '../ui/splash-screen';
import { showErrorToast } from '../ui/toast';
import { useI18n } from '../i18n/use-i18n';
import { useCurrentUserResult } from './use-current-user';

/**
 * Boundary component that handles loading and error states for the current user.
 * Shows a splash screen while loading and displays an error toast if loading fails.
 * Only renders children when the user is successfully loaded.
 */
export function CurrentUserBoundary({ children }: { children: ReactNode }) {
  const { currentUserResult } = useCurrentUserResult();
  const { t } = useI18n();

  useEffect(() => {
    if (currentUserResult.tag === 'err') {
      showErrorToast(t('users.failedToLoad'), currentUserResult.error);
    }
  }, [currentUserResult, t]);

  if (
    currentUserResult.tag === 'loading' ||
    currentUserResult.tag === 'notAsked' ||
    currentUserResult.tag === 'err'
  ) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}
