import { PolicyCheckGuard } from '~/src/permissions/policy-check-guard';
import { useEntityStoreSelector } from '~/src/store/entity-store';
import { SpinnerBlock } from '~/src/ui/spinner-block';
import { useCurrentScreen } from '../../screen/use-current-screen';
import type { NormalizationSessionId } from '../normalization-session-id';
import {
  canViewNormalizationSession,
  viewNormalizationSessionPolicy,
} from '../normalization-session-permissions';
import { useNormalizationSessionLoader } from './use-normalization-session-events-loader';
import { NormalizationSessionEntry } from './normalization-session-entry';
import { NormalizationSessionInputForm } from './normalization-session-entry-input-form';
import { NormalizationSessionTargetArtifactsHeader } from './normalization-session-target-artifacts-header';

export const NormalizationSessionScreen = (props: {
  normalizationSessionId: NormalizationSessionId;
}) => {
  const { setCurrentScreen } = useCurrentScreen();
  useNormalizationSessionLoader(props.normalizationSessionId);

  const normalizationSessionProjection = useEntityStoreSelector(
    (s) => s.entities.normalizationSessionProjections.byId[props.normalizationSessionId],
  );

  if (!normalizationSessionProjection) return <SpinnerBlock />;

  const lastEntry =
    normalizationSessionProjection.entries[normalizationSessionProjection.entries.length - 1];
  const isLastEntryInProgress =
    lastEntry?.status === 'pending' || lastEntry?.status === 'in_progress';

  return (
    <PolicyCheckGuard
      permission={canViewNormalizationSession(props.normalizationSessionId)}
      policy={viewNormalizationSessionPolicy}
      onRedirect={() => setCurrentScreen({ type: 'start-normalization-session' })}
    >
      <div className="flex h-full w-full flex-col">
        <NormalizationSessionTargetArtifactsHeader
          targetArtifactIds={normalizationSessionProjection.targetArtifactIds}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="flex w-full flex-col items-center px-8 py-8">
            <div className="w-full max-w-2xl">
              <div className="mb-8">
                {normalizationSessionProjection.entries.map((entry) => (
                  <NormalizationSessionEntry key={entry.id} entry={entry} />
                ))}
              </div>

              {!isLastEntryInProgress && (
                <NormalizationSessionInputForm
                  normalizationSessionId={props.normalizationSessionId}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </PolicyCheckGuard>
  );
};
