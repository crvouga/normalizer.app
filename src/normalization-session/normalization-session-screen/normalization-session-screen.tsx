import { useState } from 'react';
import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { ArtifactsField } from '~/src/artifacts/artifacts-input/artifacts-field';
import { useI18n } from '~/src/i18n/use-i18n';
import { PolicyCheckGuard } from '~/src/permissions/policy-check-guard';
import { useEntityStoreSelector } from '~/src/store/entity-store';
import { Button } from '~/src/ui/button';
import { SpinnerBlock } from '~/src/ui/spinner-block';
import { useCurrentScreen } from '../../screen/use-current-screen';
import type { NormalizationSessionId } from '../normalization-session-id';
import {
  canViewNormalizationSession,
  viewNormalizationSessionPolicy,
} from '../normalization-session-permissions';
import { useNormalizationSessionLoader } from './use-normalization-session-events-loader';
import { IconSparkles } from '~/src/ui/icons';

export const NormalizationSessionScreen = (props: {
  normalizationSessionId: NormalizationSessionId;
}) => {
  const { t } = useI18n();
  const { setCurrentScreen } = useCurrentScreen();
  useNormalizationSessionLoader(props.normalizationSessionId);
  const [inputArtifactIds, setInputArtifactIds] = useState<ArtifactId[]>([]);

  const normalizationSessionProjection = useEntityStoreSelector(
    (s) => s.entities.normalizationSessionProjections.byId[props.normalizationSessionId],
  );

  const handleNormalize = () => {
    // TODO: Implement normalization logic
    console.log('Normalize with input artifacts:', inputArtifactIds);
  };

  if (!normalizationSessionProjection) return <SpinnerBlock />;

  return (
    <PolicyCheckGuard
      permission={canViewNormalizationSession(props.normalizationSessionId)}
      policy={viewNormalizationSessionPolicy}
      onRedirect={() => setCurrentScreen({ type: 'start-normalization-session' })}
    >
      <div className="flex h-full w-full flex-col">
        {/* Fixed header - Target artifacts (consistent context) */}
        <div className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex w-full flex-col items-center justify-center px-8 py-4">
            <div className="w-full max-w-2xl">
              <ArtifactsField
                label={t('normalizationSession.targetArtifactsLabel')}
                value={normalizationSessionProjection.targetArtifactIds}
                onChange={() => {}}
                readOnly={true}
              />
            </div>
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex w-full flex-col items-center px-8 py-8">
            <div className="w-full max-w-2xl">
              {/* Placeholder for future content */}
              <div className="mb-8">{/* Future normalization results will appear here */}</div>

              {/* Input form at the end of content */}
              <div className="space-y-4">
                <ArtifactsField
                  label={t('normalizationSession.inputArtifactsLabel')}
                  value={inputArtifactIds}
                  onChange={setInputArtifactIds}
                />
                <div className="flex justify-end">
                  <Button
                    size="lg"
                    startIcon={<IconSparkles className="size-6" />}
                    text={t('normalizationSession.normalize')}
                    onClick={handleNormalize}
                    disabled={inputArtifactIds.length === 0}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PolicyCheckGuard>
  );
};
