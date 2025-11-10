import { Button } from '~/src/ui/button';

import { useState } from 'react';
import type { ArtifactId } from '../artifacts/artifact-id';
import { ArtifactsField } from '../artifacts/artifacts-input/artifacts-field';
import { useI18n } from '../i18n/use-i18n';
import { Form } from '../ui/form';
import type { NormalizationSessionId } from './normalization-session-id';
import { useStartNormalizationSession } from './use-start-normalization-session';

export const NormalizationSessionScreen = (props: {
  normalizationSessionId: NormalizationSessionId | null;
}) => {
  const { t } = useI18n();
  const [targetArtifactIds, setTargetArtifactIds] = useState<ArtifactId[]>([]);

  const { startSession, isStarting } = useStartNormalizationSession({
    onStartComplete: (result) => {
      if (result.tag === 'ok') {
        console.log('Session started successfully:', result.value.sessionId);
        // Reset the form
        setTargetArtifactIds([]);
      }
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
