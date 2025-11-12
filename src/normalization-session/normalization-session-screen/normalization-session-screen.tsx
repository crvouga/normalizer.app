import { PolicyCheckGuard } from '~/src/permissions/policy-check-guard';
import { useCurrentScreen } from '../../screen/use-current-screen';
import type { NormalizationSessionId } from '../normalization-session-id';
import {
  canViewNormalizationSession,
  viewNormalizationSessionPolicy,
} from '../normalization-session-permissions';
import { useNormalizationSessionEventsLoader } from './use-normalization-session-events-loader';
import { useNormalizationSessionEventsSelector } from './use-normalization-session-events-selector';

export const NormalizationSessionScreen = (props: {
  normalizationSessionId: NormalizationSessionId;
}) => {
  const { setCurrentScreen } = useCurrentScreen();
  useNormalizationSessionEventsLoader(props.normalizationSessionId);
  const normalizationSessionEvents = useNormalizationSessionEventsSelector(
    props.normalizationSessionId,
  );

  return (
    <PolicyCheckGuard
      permission={canViewNormalizationSession(props.normalizationSessionId)}
      policy={viewNormalizationSessionPolicy}
      onRedirect={() => setCurrentScreen({ type: 'start-normalization-session' })}
    >
      <div className="flex h-full w-full items-start justify-center p-8">
        <div className="flex w-full max-w-2xl flex-col gap-6">
          {normalizationSessionEvents.map((e) => (
            <div key={e.id} className="flex flex-col gap-2">
              <p>{e.event.type}</p>
            </div>
          ))}
        </div>
      </div>
    </PolicyCheckGuard>
  );
};
