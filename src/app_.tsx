import { AuthRedirectHandler } from './auth/auth-redirect-handler';
import { useI18n } from './i18n/use-i18n';
import { NormalizationSessionId } from './normalization-session/normalization-session-id';
import { NormalizationSessionScreen } from './normalization-session/normalization-session-screen/normalization-session-screen';
import { useCurrentScreen } from './screen/use-current-screen';
import { AnimatedLogo } from './ui/animated-logo';
import { Button } from './ui/button';
import { SidebarFooter, SidebarHeader, SidebarRoot } from './ui/sidebar';
import { SidebarLayout } from './ui/sidebar-layout';
import { CurrentUserBoundary } from './users/current-user-boundary';
import { useCurrentUser } from './users/use-current-user';
import { UserProfileSidebarItem } from './users/user-profile-sidebar-item';

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
  const { currentUserResult } = useCurrentUser();

  const user = currentUserResult.tag === 'ok' ? currentUserResult.value : null;
  const currentScreen = useCurrentScreen();
  return (
    <SidebarRoot>
      <SidebarHeader icon={<AnimatedLogo size="sm" />} title={t('app.title')} />
      <div className="w-full p-4">
        <Button
          className="w-full"
          text={t('app.newSession')}
          onClick={() => currentScreen.setCurrentScreen({ type: 'normalization-session' })}
        />
      </div>
      <div className="w-full flex-1"></div>
      <SidebarFooter content={<UserProfileSidebarItem user={user} />} />
    </SidebarRoot>
  );
}

function AppScreen() {
  const { currentScreen } = useCurrentScreen();
  switch (currentScreen.type) {
    case 'normalization-session':
      return (
        <NormalizationSessionScreen
          normalizationSessionId={NormalizationSessionId.schema
            .nullable()
            .parse(currentScreen.normalizationSessionId ?? null)}
        />
      );
  }
}
