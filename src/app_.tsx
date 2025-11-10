import { useI18n } from './i18n/use-i18n';
import { NormalizationSessionScreen } from './normalization-session/normalization-session-screen';
import { useCurrentScreen } from './screen/use-current-screen';
import { SettingsButton } from './settings/settings-button';
import { Button } from './ui/button';
import { IconPlus, IconSparkles } from './ui/icons';
import { SidebarFooter, SidebarHeader, SidebarRoot } from './ui/sidebar';
import { SidebarLayout } from './ui/sidebar-layout';
import { useCurrentUser } from './users/use-current-user';
import { UserProfile } from './users/user-profile';
import { CurrentUserBoundary } from './users/current-user-boundary';
import { AuthRedirectHandler } from './auth/auth-redirect-handler';

export function App() {
  return (
    <CurrentUserBoundary>
      <AuthRedirectHandler />
      <div className="flex h-dvh flex-row overflow-hidden bg-white text-gray-900 dark:bg-gray-900 dark:text-white">
        <SidebarLayout sidebar={<AppSidebar />} main={<AppScreen />} />
      </div>
    </CurrentUserBoundary>
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
