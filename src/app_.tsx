import { NormalizationSessionScreen } from './normalization-session/normalization-session-screen';
import { useCurrentScreen } from './screen/use-current-screen';
import { IconPlus, IconSparkles } from './ui/icons';
import { SidebarAction, SidebarHeader, SidebarRoot } from './ui/sidebar';

export const App = () => {
  return (
    <div className="flex min-h-screen flex-row bg-gray-900 text-white">
      <AppSidebar />
      <div className="h-full flex-1">
        <CurrentScreen />
      </div>
    </div>
  );
};

const CurrentScreen = () => {
  const { currentScreen } = useCurrentScreen();
  switch (currentScreen.type) {
    case 'normalization-workflow':
      return (
        <NormalizationSessionScreen
          normalizationWorkflowId={currentScreen.normalizationWorkflowId}
        />
      );
    default:
      return <div>Unknown screen</div>;
  }
};

const AppSidebar: React.FC = () => (
  <SidebarRoot>
    <SidebarHeader icon={<IconSparkles className="size-8" />} title="normalizer.app" />
    <SidebarAction>
      <IconPlus className="size-6" />
      New Session
    </SidebarAction>
  </SidebarRoot>
);
