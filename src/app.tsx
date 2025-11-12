import { AuthRedirectHandler } from './auth/auth-redirect-handler';
import { useI18n } from './i18n/use-i18n';
import { NormalizationSessionId } from './normalization-session/normalization-session-id';
import { NormalizationSessionProjectionList } from './normalization-session/normalization-session-list/normalization-session-list';
import { NormalizationSessionScreen } from './normalization-session/normalization-session-screen/normalization-session-screen';
import { StartNormalizationSessionScreen } from './normalization-session/start-normalization-session/start-normalization-session-screen';
import { useCurrentScreen } from './screen/use-current-screen';
import { Sparkles } from './ui/sparkles';
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
      <div className="flex h-dvh flex-row overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50">
        <SidebarLayout sidebar={<AppSidebar />} main={<AppScreen />} />
      </div>
    </CurrentUserBoundary>
  );
}

function AppSidebar() {
  const { t } = useI18n();
  const user = useCurrentUser();
  const currentScreen = useCurrentScreen();

  const handleSessionClick = (sessionId: NormalizationSessionId) => {
    currentScreen.setCurrentScreen({
      type: 'normalization-session',
      normalizationSessionId: sessionId,
    });
  };

  return (
    <SidebarRoot>
      <SidebarHeader icon={<Sparkles size="sm" />} title={t('app.title')} />
      <div className="w-full p-4">
        <Button
          className="w-full"
          text={t('app.newSession')}
          onClick={() => currentScreen.setCurrentScreen({ type: 'start-normalization-session' })}
        />
      </div>
      <div className="w-full flex-1 overflow-hidden">
        <NormalizationSessionProjectionList
          userId={user.id}
          onSessionClick={handleSessionClick}
          isSelected={(id) =>
            currentScreen.currentScreen.type === 'normalization-session' &&
            currentScreen.currentScreen.normalizationSessionId === id
          }
        />
      </div>
      <SidebarFooter content={<UserProfileSidebarItem user={user} />} />
    </SidebarRoot>
  );
}

function AppScreen() {
  const { currentScreen } = useCurrentScreen();
  switch (currentScreen.type) {
    case 'start-normalization-session': {
      return <StartNormalizationSessionScreen />;
    }
    case 'normalization-session': {
      return (
        <NormalizationSessionScreen
          normalizationSessionId={NormalizationSessionId.schema.parse(
            currentScreen.normalizationSessionId,
          )}
        />
      );
    }
  }
}
