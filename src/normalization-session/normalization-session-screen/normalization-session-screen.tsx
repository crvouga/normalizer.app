import type { NormalizationSessionId } from '../normalization-session-id';
import { NormalizationSessionStartScreen } from './normalization-session-start-screen';
import { NormalizationSessionStartedScreen } from './normalization-session-started-screen';

export const NormalizationSessionScreen = (props: {
  normalizationSessionId: NormalizationSessionId | null;
}) => {
  if (props.normalizationSessionId) {
    return (
      <NormalizationSessionStartedScreen normalizationSessionId={props.normalizationSessionId} />
    );
  }
  return <NormalizationSessionStartScreen />;
};
