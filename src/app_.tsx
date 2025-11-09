import { useI18n } from './i18n/use-i18n';
import { NormalizationSessionScreen } from './normalization-session/normalization-session-screen';
import { useCurrentScreen } from './screen/use-current-screen';
import { SettingsButton } from './settings/settings-button';
import { Button } from './ui/button';
import { IconPlus, IconSparkles } from './ui/icons';
import { SidebarFooter, SidebarHeader, SidebarRoot } from './ui/sidebar';
import { SidebarLayout } from './ui/sidebar-layout';

export function App() {
  return (
    <div className="flex h-dvh flex-row overflow-hidden bg-white text-gray-900 dark:bg-gray-900 dark:text-white">
      <SidebarLayout sidebar={<AppSidebar />} main={<AppScreen />} />
    </div>
  );
}

function AppSidebar() {
  const { t } = useI18n();
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
          <div className="flex w-full items-center justify-end">
            <SettingsButton />
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
