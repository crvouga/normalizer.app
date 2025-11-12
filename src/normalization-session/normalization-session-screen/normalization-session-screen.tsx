import type { NormalizationSessionId } from '../normalization-session-id';
import { useNormalizationSessionEventsLoader } from './use-normalization-session-events-loader';
import { useNormalizationSessionEventsSelector } from './use-normalization-session-events-selector';
import { useNormalizationSessionPermission } from '../use-normalization-session-permission';
import { PermissionGuard } from '../../permissions/permission-guard';
import { useCurrentScreen } from '../../screen/use-current-screen';

export const NormalizationSessionScreen = (props: {
  normalizationSessionId: NormalizationSessionId;
}) => {
  const { canView, isLoading, error } = useNormalizationSessionPermission(
    props.normalizationSessionId,
  );
  const { setCurrentScreen } = useCurrentScreen();

  useNormalizationSessionEventsLoader(props.normalizationSessionId);
  const normalizationSessionEvents = useNormalizationSessionEventsSelector(
    props.normalizationSessionId,
  );

  return (
    <PermissionGuard
      hasPermission={canView}
      isLoading={isLoading}
      error={error}
      fallbackScreen={{ type: 'start-normalization-session' }}
      onRedirect={setCurrentScreen}
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
    </PermissionGuard>
  );
};
