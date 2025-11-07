import { NormalizationSessionScreen } from './normalization-session/normalization-session-screen';
import { useCurrentScreen } from './screen/use-current-screen';
import { IconPlus, IconSparkles } from './ui/icons';
import { SidebarAction, SidebarHeader, SidebarRoot } from './ui/sidebar';

export const App = () => {
  return (
    <div className="flex min-h-screen flex-row bg-gray-900 text-white">
      <AppSidebar />
      <div className="h-full flex-1 shrink-0">
        <CurrentScreen />
      </div>
    </div>
  );
};

const CurrentScreen = () => {
  const { currentScreen } = useCurrentScreen();
  switch (currentScreen.type) {
    case 'normalization-session':
      return (
        <NormalizationSessionScreen normalizationSessionId={currentScreen.normalizationSessionId} />
      );
  }
};

const AppSidebar: React.FC = () => (
  <SidebarRoot>
    <SidebarHeader icon={<IconSparkles className="size-8" />} title="normalizer.app" />
    <SidebarAction label="New Session" icon={<IconPlus className="size-6" />} />
  </SidebarRoot>
);
