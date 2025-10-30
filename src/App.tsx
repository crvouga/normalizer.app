import { NormalizationWorkflowScreen } from './normalization-workflow/normalization-workflow-screen';
import { useCurrentScreen } from './screen/use-current-screen';

export const App = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <CurrentScreen />
    </div>
  );
};

const CurrentScreen = () => {
  const { currentScreen } = useCurrentScreen();
  switch (currentScreen.type) {
    case 'normalization-workflow':
      return <NormalizationWorkflowScreen />;
    default:
      return <div>Unknown screen</div>;
  }
};
