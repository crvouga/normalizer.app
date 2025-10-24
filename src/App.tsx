import { NormalizationWorkflowScreen } from "./normalization-workflow/normalization-workflow/NormalizationWorkflow";
import { StartNormalizationWorkflowScreen } from "./normalization-workflow/start-normalization-workflow/StartNormalizationWorkflow";
import { useCurrentScreen } from "./screen/useCurrentScreen";

export const App = () => {
  const { currentScreen } = useCurrentScreen();
  switch (currentScreen.type) {
    case "start-normalization":
      return <StartNormalizationWorkflowScreen />;
    case "normalization-workflow":
      return <NormalizationWorkflowScreen />;
  }
};
