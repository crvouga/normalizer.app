import { ArtifactsField } from '~/src/artifacts/artifacts-input/artifacts-field';
import { useI18n } from '~/src/i18n/use-i18n';
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
import { Divider } from '~/src/ui/divider';

export const NormalizationSessionScreen = (props: {
  normalizationSessionId: NormalizationSessionId;
}) => {
  const { t } = useI18n();
  const { setCurrentScreen } = useCurrentScreen();
  useNormalizationSessionLoader(props.normalizationSessionId);

  const normalizationSessionProjection = useEntityStoreSelector(
    (s) => s.entities.normalizationSessionProjections.byId[props.normalizationSessionId],
  );

  if (!normalizationSessionProjection) return <SpinnerBlock />;

  return (
    <PolicyCheckGuard
      permission={canViewNormalizationSession(props.normalizationSessionId)}
      policy={viewNormalizationSessionPolicy}
      onRedirect={() => setCurrentScreen({ type: 'start-normalization-session' })}
    >
      <div className="flex h-full w-full flex-col items-start justify-start">
        <div className="flex w-full flex-col items-center justify-center gap-6 px-8 py-4 pt-8">
          <div className="flex w-full max-w-2xl flex-col gap-6">
            <ArtifactsField
              label={t('normalizationSession.targetArtifactsLabel')}
              value={normalizationSessionProjection.targetArtifactIds}
              onChange={() => {}}
              readOnly={true}
            />
          </div>
        </div>
        <Divider />
        <div className="flex w-full flex-col items-center justify-center gap-6 px-8 py-4 pt-8">
          <div className="flex w-full max-w-2xl flex-col gap-6">
            <ArtifactsField
              label={t('normalizationSession.inputArtifactsLabel')}
              value={[]}
              onChange={() => {}}
            />
          </div>
        </div>
      </div>
    </PolicyCheckGuard>
  );
};
