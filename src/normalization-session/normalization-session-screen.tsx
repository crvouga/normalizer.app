import { Button } from '~/src/ui/button';

import { useState } from 'react';
import type { ArtifactId } from '../artifacts/artifact-id';
import { ArtifactsField } from '../artifacts/artifacts-input/artifacts-field';
import { useI18n } from '../i18n/use-i18n';
import { isOk } from '../lib/result';
import { useCurrentScreen } from '../screen/use-current-screen';
import { Form } from '../ui/form';
import { showErrorToast, showSuccessToast } from '../ui/toast';
import type { NormalizationSessionId } from './normalization-session-id';
import { useStartNormalizationSession } from './use-start-normalization-session';

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

const NormalizationSessionStartedScreen = (props: {
  normalizationSessionId: NormalizationSessionId;
}) => {
  return (
    <div className="flex h-full w-full items-start justify-center p-8">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <h1 className="text-2xl font-bold">Normalization Session Started</h1>
      </div>
    </div>
  );
};

const NormalizationSessionStartScreen = () => {
  const { t } = useI18n();
  const [targetArtifactIds, setTargetArtifactIds] = useState<ArtifactId[]>([]);
  const currentScreen = useCurrentScreen();
  const { startSession, isStarting } = useStartNormalizationSession({
    async onStartComplete(result) {
      if (isOk(result)) {
        setTargetArtifactIds([]);
        currentScreen.setCurrentScreen(
          {
            normalizationSessionId: result.value.sessionId,
            type: 'normalization-session',
          },
          'push',
        );
        showSuccessToast(t('session.startSuccess'));
        return;
      }
      showErrorToast(t('session.startError'), result.error);
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (targetArtifactIds.length === 0) return;

    await startSession({ targetArtifactIds });
  };

  return (
    <div className="flex h-full w-full items-start justify-center p-8">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <Form onSubmit={handleSubmit} disabled={isStarting} className="flex flex-col gap-6">
          <ArtifactsField
            label={t('session.targetArtifact')}
            value={targetArtifactIds}
            onChange={setTargetArtifactIds}
          />

          <div className="flex justify-end">
            <Button
              size="lg"
              type="submit"
              disabled={targetArtifactIds.length === 0}
              loading={isStarting}
              text={t('session.startButton')}
            />
          </div>
        </Form>
      </div>
    </div>
  );
};
