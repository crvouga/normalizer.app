import { NormalizationWorkflowScreen } from "./normalization-workflow/normalization-workflow/normalization-workflow-screen";
import { StartNormalizationWorkflowScreen } from "./normalization-workflow/start-normalization-workflow/start-normalization-workflow-screen";
import { TrpcExample } from "./components/trpc-example";
import { useCurrentScreen } from "./screen/use-current-screen";

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
    case "start-normalization":
      return <StartNormalizationWorkflowScreen />;
    case "normalization-workflow":
      return <NormalizationWorkflowScreen />;
    case "trpc-example":
      return <TrpcExample />;
  }
};
