import { AuthRedirectHandler } from './auth/auth-redirect-handler';
import { useI18n } from './i18n/use-i18n';
import { WorkspaceId } from './workspace/workspace-id';
import { WorkspaceProjectionList } from './workspace/workspace-list/workspace-list';
import { WorkspaceScreen } from './workspace/workspace-screen/workspace-screen';
import { StartWorkspaceScreen } from './workspace/workspace-start-screen/workspace-start-screen';
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

  const handleSessionClick = (sessionId: WorkspaceId) => {
    currentScreen.setCurrentScreen({
      type: 'workspace',
      workspaceId: sessionId,
    });
  };

  return (
    <SidebarRoot>
      <SidebarHeader icon={<Sparkles size="sm" />} title={t('app.title')} />
      <div className="w-full p-4">
        <Button
          className="w-full"
          text={t('app.newSession')}
          onClick={() => currentScreen.setCurrentScreen({ type: 'start-workspace' })}
        />
      </div>
      <div className="w-full flex-1 overflow-hidden">
        <WorkspaceProjectionList
          userId={user.id}
          onSessionClick={handleSessionClick}
          isSelected={(id) =>
            currentScreen.currentScreen.type === 'workspace' &&
            currentScreen.currentScreen.workspaceId === id
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
    case 'start-workspace': {
      return <StartWorkspaceScreen />;
    }
    case 'workspace': {
      return (
        <WorkspaceScreen
          workspaceId={WorkspaceId.schema.parse(
            currentScreen.workspaceId,
          )}
        />
      );
    }
  }
}
