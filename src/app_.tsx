import { useEffect } from 'react';
import { useI18n } from './i18n/use-i18n';
import { NormalizationSessionScreen } from './normalization-session/normalization-session-screen';
import { useCurrentScreen } from './screen/use-current-screen';
import { SettingsButton } from './settings/settings-button';
import { Button } from './ui/button';
import { IconPlus, IconSparkles } from './ui/icons';
import { SidebarFooter, SidebarHeader, SidebarRoot } from './ui/sidebar';
import { SidebarLayout } from './ui/sidebar-layout';
import { SplashScreen } from './ui/splash-screen';
import { showToast, showErrorToast } from './ui/toast';
import { useCurrentUser } from './users/use-current-user';
import { UserProfile } from './users/user-profile';

export function App() {
  const currentUserResult = useCurrentUser();

  // Handle auth redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authSuccess = params.get('auth_success');
    const authError = params.get('auth_error');

    if (authSuccess) {
      showToast('Successfully signed in with Google', 'success');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (authError) {
      const errorMessages: Record<string, string> = {
        invalid_state: 'Authentication failed: Invalid state (possible CSRF attack)',
        missing_params: 'Authentication failed: Missing parameters',
        not_configured: 'Google authentication is not configured',
        oauth_failed: 'Authentication failed: Could not complete sign in',
        config_error: 'Authentication failed: Configuration error',
      };
      const message = errorMessages[authError] || 'Authentication failed';
      showErrorToast(message);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  if (currentUserResult.tag === 'loading' || currentUserResult.tag === 'notAsked') {
    return <SplashScreen />;
  }

  if (currentUserResult.tag === 'err') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">Failed to load user</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {currentUserResult.error.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-row overflow-hidden bg-white text-gray-900 dark:bg-gray-900 dark:text-white">
      <SidebarLayout sidebar={<AppSidebar />} main={<AppScreen />} />
    </div>
  );
}

function AppSidebar() {
  const { t } = useI18n();
  const currentUserResult = useCurrentUser();

  // Only show user profile if user is loaded
  const user = currentUserResult.tag === 'ok' ? currentUserResult.value : null;

  return (
    <SidebarRoot>
      <SidebarHeader icon={<IconSparkles className="size-8" />} title={t('app.title')} />
      <div className="w-full p-4">
        <Button
          className="w-full"
          text={t('app.newSession')}
          startIcon={<IconPlus className="size-6" />}
        />
      </div>
      <div className="w-full flex-1"></div>
      <SidebarFooter
        content={
          <div className="flex w-full flex-col gap-2">
            {user && <UserProfile user={user} />}
            <div className="flex w-full items-center justify-end">
              <SettingsButton />
            </div>
          </div>
        }
      />
    </SidebarRoot>
  );
}

function AppScreen() {
  const { currentScreen } = useCurrentScreen();
  switch (currentScreen.type) {
    case 'normalization-session':
      return (
        <NormalizationSessionScreen normalizationSessionId={currentScreen.normalizationSessionId} />
      );
  }
}
