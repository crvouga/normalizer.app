import { useQueryParam } from "~/src/lib/use-query-param";
import { CurrentScreen } from "./current-screen";

export const useCurrentScreen = () => {
  const [currentScreen, setCurrentScreen] = useQueryParam({
    paramName: "screen",
    parser: CurrentScreen,
    defaultValue: {
      type: "start-normalization",
    },
  });

  return { currentScreen, setCurrentScreen };
};
