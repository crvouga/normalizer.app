import { NormalizationSessionScreen } from './normalization-session/normalization-session-screen';
import { useCurrentScreen } from './screen/use-current-screen';
import { Button } from './ui/button';
import { IconPlus, IconSparkles } from './ui/icons';
import { SidebarHeader, SidebarRoot } from './ui/sidebar';
import { SidebarLayout } from './ui/sidebar-layout';

export const App = () => {
  return (
    <div className="flex h-dvh flex-row overflow-hidden bg-gray-900 text-white">
      <SidebarLayout
        sidebar={
          <SidebarRoot>
            <SidebarHeader icon={<IconSparkles className="size-8" />} title="normalizer.app" />
            <div className="w-full p-4">
              <Button
                className="w-full"
                text="New Session"
                startIcon={<IconPlus className="size-6" />}
              />
            </div>
          </SidebarRoot>
        }
        main={<CurrentScreen />}
      />
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
